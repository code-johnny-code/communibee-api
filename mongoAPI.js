require('dotenv').config();
const turf = require('@turf/turf');
const h3 = require("h3-js");
const { v4: uuidv4 } = require('uuid');
const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.DB_URL, { useNewUrlParser: true, auth: {
    user: process.env.DB_USER,
    password: process.env.DB_PW
  }});
const dbName = process.env.DB_NAME;
const nodemailer = require('nodemailer');

const notifySwarmCatchers = (h3Cell, POC, details) => {
  const db = client.db(dbName);
  const collection = db.collection('users');
  collection.find({swarmCatcher: true, swarmZones: h3Cell}).toArray((err, catchers) => {
    catchers.forEach(catcher => {
      sendEmail(catcher.email, POC, details)
    })
  });
};

const sendEmail = (catcherEmail, swarmPOC, swarmDetails) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PW
    }
  });
  const locationCoords = turf.toWgs84([swarmDetails.long, swarmDetails.lat]);
  const mailOptions = {
    from: process.env.EMAIL_USER,
      to: catcherEmail,
      subject: 'New Bee Swarm in your area!',
      text: `A new Swarm has been reported in your area! \n \n` +
        `DETAILS \n \n` +
        `Location: https://www.google.com/maps/@${locationCoords[1]},${locationCoords[0]},20z \n \n` +
        `Distance From Ground: ${swarmDetails.distanceFromGround} \n \n` +
        `Contact: ${swarmPOC} \n \n` +
        `Other Beekeepers have probably received this alert as well, so be sure to "claim" it on Communibee!`
  };
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};

const updateNearbyApiaryCountAndIssues = (h3Cell) => {
  // Get the h3 cell and all of its neighboring cells
  const cellPlusNeighbors = h3.kRing(h3Cell, 1);
  const db = client.db(dbName);
  const collection = db.collection('apiaries');
  // Get records for each apiary within the h3 cells
  collection.find({h3: {$in: cellPlusNeighbors}, deleted: false}).toArray(function(err, apiaries) {
    if (err) {
      return {'error': err};
    } else {
      // TODO: Make the distance calculation between each apiary not so horribly inefficient
      // Calculate distance between each apiary
      apiaries.forEach(apiary1 => {
        // Reset the nearbyApiaries count and nearbyIssues
        apiary1.nearbyApiaries = 0;
        apiary1.nearbyIssues = [];
        apiaries.forEach(apiary2 => {
          if (apiary1.apiaryId !== apiary2.apiaryId) {
            // Convert coordinates to WGS84 so turf can measure distance
            const firstLocConverted = turf.toWgs84([apiary1.location.long, apiary1.location.lat]);
            const secondLocConverted = turf.toWgs84([apiary2.location.long, apiary2.location.lat]);
            const calculatedDistance = turf.distance(firstLocConverted, secondLocConverted, {units: 'miles'});
            // Increment the count each time an apiary is within 2 miles
            if (calculatedDistance < 2) {
              apiary1.nearbyApiaries++;
              const apiaryIssues = apiary2.hives.filter(hive => !hive.deleted).map(hive => hive.issues).flat();
              if (apiaryIssues.flat().length) { apiary1.nearbyIssues.push([...new Set(apiaryIssues)]) }
            }
          }
        });
        apiary1.nearbyIssues = [...new Set(apiary1.nearbyIssues.flat())];
        // Update nearbyApiaries count and nearbyIssues for all apiaries
        collection.findOneAndUpdate({apiaryId: apiary1.apiaryId}, {$set: {nearbyApiaries: apiary1.nearbyApiaries, nearbyIssues: apiary1.nearbyIssues}})
      });
    }
  })
};

module.exports = {
  addUser(data, response) {
    // { name: 'John R', email: 'boop@doopadoop.boop' }
    const {name, email} = data;
    client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('users');
      return collection.insertOne({
          userId: uuidv4(),
          name: name,
          email: email,
          swarmCatcher: false,
          joined: Date.now(),
        },
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            response(res);
          }
        })
    })
  },
  getUserInfo(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f' }
    const {userId} = data.query;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('users');
      collection.findOne({userId}, (error, res) => {
        if (error) {
          response({'error': res});
        } else {
          response(res);
        }
      })
    })
  },
  addApiary(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', name: 'Serenity Valley Apiary', lat: 4601968.398754628, long: -10065674.366864335 }
    const {userId, name, lat, long} = data;
    client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('apiaries');
      const apiaryId = uuidv4();
      const h3Cell = h3.geoToH3(lat, long, 6);
      const payload = {
        userId: userId,
        apiaryId: apiaryId,
        name: name,
        location: {lat, long},
        h3: h3Cell,
        created: Date.now(),
        hives: [],
        deleted: false,
        nearbyApiaries: 0,
        nearbyIssues: [],
      };
      return collection.insertOne(payload,
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            updateNearbyApiaryCountAndIssues(h3Cell);
            response(res);
          }
      })
    });
  },
  addHive(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', apiaryId: '6dde6060-c98e-4955-b4cd-70475ef4b84d', name: 'Bee Arthur & the Golden Girls', species: 'Italian', issues: ['Small Hive Beetles'] }
    client.connect(() => {
      const {userId, apiaryId, name, species, issues} = data;
      const db = client.db(dbName);
      const hiveId = uuidv4();
      const collection = db.collection('apiaries');
      const hiveDetails = {
        name,
        userId,
        species,
        issues,
        hiveId,
        deleted: false,
      };
      collection.findOneAndUpdate({apiaryId, userId}, {$push: {hives: hiveDetails}},
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            updateNearbyApiaryCountAndIssues(res.value.h3);
            response(res);
          }
        })
    })
  },
  removeHive(data, response) {
    // { apiaryId: '6dde6060-c98e-4955-b4cd-70475ef4b84d', hiveId: 'f4154a05-b59a-46b3-9359-3a9a293723db', userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f' }
    client.connect(() => {
      const {apiaryId, userId, hiveId} = data;
      const db = client.db(dbName);
      const collection = db.collection('apiaries');
      collection.updateOne({apiaryId, userId, hives: {$elemMatch: {hiveId}}}, {$set: {"hives.$.deleted": true}},
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            collection.findOne({apiaryId}, (err, apiary) => {
              updateNearbyApiaryCountAndIssues(apiary.h3)
            });
            response(res);
          }
        })
    })
  },
  getApiaries(data, response) {
    const {userId} = data.query;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('apiaries');
      collection.find({deleted: false}).toArray(function(err, items) {
        if (err) {
          response({'error': err});
        } else {
          const hiveResponse = {
            myApiaries: items.filter(apiary => userId === apiary.userId),
            otherApiaries: items.filter(apiary => userId !== apiary.userId).map(apiary => {
              return {
                h3: apiary.h3,
              };
            })
          };
          response(hiveResponse);
        }
      });
    });
  },
  addSwarm(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', lat: 4601968.398754628, long: -10065674.366864335, contactInfo: 'John, 314-111-1111', firstSeen: , distanceFromGround: 10 }
    const {lat, long, userId, firstSeen, distanceFromGround, contactInfo} = data;
    client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('swarms');
      const h3Cell = h3.geoToH3(lat, long, 6);
      const recordToSave = {
        swarmId: uuidv4(),
        userId: userId,
        location: {lat, long},
        h3: h3Cell,
        reported: Date.now(),
        firstSeen: firstSeen,
        distanceFromGround: distanceFromGround,
        contactInfo: contactInfo,
        claimed: false,
        retrieved: false,
      };
      notifySwarmCatchers(h3Cell, contactInfo, {lat, long, distanceFromGround});
      collection.insertOne(recordToSave,
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            response(res);
          }
        })
    })
  },
  getSwarms(data, response) {
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('swarms');
      collection.find({retrieved: false}).toArray(function(err, items) {
        if (err) {
          response({'error': err});
        } else {
          const responseItems = items.map(swarm => {
            return swarm;
          });
          response(responseItems);
        }
      });
    });
  },
  claimSwarm(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', swarmId: '1198acc3-c861-41a3-8ea3-6a06e0ca530c' }
    const {swarmId, userId} = data;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('swarms');
      collection.findOneAndUpdate({swarmId}, {$set: {claimed: true, claimedBy: userId}},
        function (error, res) {
        if (error) {
          response({'error': res});
        } else {
          response(res);
        }
      })
    })
  },
  unclaimSwarm(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', swarmId: '1198acc3-c861-41a3-8ea3-6a06e0ca530c' }
    const {userId, swarmId} = data;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('swarms');
      collection.findOneAndUpdate({swarmId: swarmId, claimedBy: userId}, {$set: {claimed: false, claimedBy: ''}},
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            response(res);
          }
        })
    })
  },
  swarmRetrieved(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', swarmId: '1198acc3-c861-41a3-8ea3-6a06e0ca530c', timeCollected:  }
    const {userId, swarmId, timeCollected} = data;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('swarms');
      collection.findOneAndUpdate({swarmId}, {$set: {retrieved: true, retrievedBy: userId, timeCollected}},
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            response(res);
          }
        })
    })
  },
  autonomousSwarmRetrieved(data, response) {
    // TODO: Make sure this actually works
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', retrievedByUser: true, firstSeen, timeCollected: , lat: , long: , distanceFromGround: 10 }
    const {userId, retrievedByUser, firstSeen, timeCollected, lat, long, distanceFromGround} = data;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('swarms');
      const h3Cell = h3.geoToH3(lat, long, 6);
      const payload = {
        swarmId: uuidv4(),
        source: 'autonomous',
        userId,
        retrievedByUser,
        firstSeen,
        timeCollected,
        lat,
        long,
        h3Cell,
        distanceFromGround,
        retrieved: true
      };
      collection.insertOne(payload,
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            response(res);
          }
        })
    })
  },
  addSwarmRetrievalZones(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', zones: [] }
    const {userId, zones} = data;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('users');
      collection.findOneAndUpdate({userId}, {$set: {swarmCatcher: true, swarmZones: zones}},
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
            response(res);
          }
        })
    })
  }
};
