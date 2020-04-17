require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.DB_URL, { useNewUrlParser: true, auth: {
    user: process.env.DB_USER,
    password: process.env.DB_PW
  }});
const dbName = process.env.DB_NAME;

const hasValidKey = receivedKey => {
  return receivedKey === process.env.API_KEY
} ;

module.exports = {
  registerNewUser(data, response) {
    if (hasValidKey(data.key)) {
      delete data.key;
      client.connect(() => {
        const db = client.db(dbName);
        const collection = db.collection('users');
        return collection.insertOne({userId: data.userId, name: data.name, joined: Date.now()},
          function (error, res) {
            if (error) {
              response({'error': res});
            } else {
              response(res);
            }
          })
      })
    } else {
      response({'error': 'Unauthorized'})
    }
  },
  addHive(data, response) {
    if (hasValidKey(data.key)) {
      delete data.key;
      client.connect(() => {
        const db = client.db(dbName);
        const collection = db.collection('hives');
        return collection.insertOne({userId: data.userId, hiveName: data.deviceId, coordinates: {latitude: data.lat, longitude: data.lon}, issues: []},
          function (error, res) {
            if (error) {
              response({'error': res});
            } else {
              response(res);
            }
          })
      })
    } else {
      response({'error': 'Unauthorized'})
    }
  },
  updateHive(data, response) {
    if (hasValidKey(data.key)) {
      delete data.key;
      client.connect(() => {
        const db = client.db(dbName);
        const collection = db.collection('hives');
        return collection.findOneAndUpdate({},
          function (error, res) {
            if (error) {
              response({'error': res});
            } else {
              response(res);
            }
          })
      })
    } else {
      response({'error': 'Unauthorized'})
    }
  }
};
