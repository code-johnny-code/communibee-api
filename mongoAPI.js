require('dotenv').config();
const h3 = require("h3-js");
const { v4: uuidv4 } = require('uuid');
const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.DB_URL, { useNewUrlParser: true, auth: {
    user: process.env.DB_USER,
    password: process.env.DB_PW
  }});
const dbName = process.env.DB_NAME;

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
  addApiary(data, response) {
    // { userId: 'e0c66481-9f4c-4c0c-b7d0-d9d1ba7b455f', name: 'Serenity Valley Apiary', lat: 4601968.398754628, long: -10065674.366864335 }
    const {userId, name, lat, long} = data;
    client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('apiaries');
      const apiaryId = uuidv4();
      const h3Cell = h3.geoToH3(lat, long, 6);
      return collection.insertOne({
          userId: userId,
          apiaryId: apiaryId,
          name: name,
          location: {lat, long},
          h3: h3Cell,
          created: Date.now(),
          hives: []
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
  addHive(data, response) {
    // { apiaryId: '6dde6060-c98e-4955-b4cd-70475ef4b84d', name: 'Bee Arthur & the Golden Girls', species: 'Italian', issues: ['Small Hive Beetles'] }
    client.connect(() => {
      const {apiaryId, name, species, issues} = data;
      const db = client.db(dbName);
      const hiveId = uuidv4();
      const collection = db.collection('apiaries');
      const hiveDetails = {
        name: name,
        species: species,
        issues: issues,
        hiveId: hiveId,
      };
      collection.findOneAndUpdate({apiaryId: apiaryId}, {$push: {hives: hiveDetails}},
        function (error, res) {
          if (error) {
            response({'error': res});
          } else {
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
      collection.find().toArray(function(err, items) {
        if (err) {
          response({'error': err});
        } else {
          const hiveResponse = {
            myApiaries: items.filter(apiary => userId === apiary.userId),
            otherApiaries: items.filter(apiary => userId !== apiary.userId).map(apiary => {
              delete apiary.location;
              delete apiary.userId;
              return apiary;
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
      };
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
      collection.find().toArray(function(err, items) {
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
    // { swarmId: '1198acc3-c861-41a3-8ea3-6a06e0ca530c' }
    const {swarmId, userId} = data;
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('swarms');
      collection.findOneAndUpdate({swarmId}, {$set: {claimed: false, claimedBy: ''}},
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
