require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.DB_URL, { useNewUrlParser: true, auth: {
    user: process.env.DB_USER,
    password: process.env.DB_PW
  }});
const dbName = process.env.DB_NAME;

const makeGeoJSON = (name, lat, long) => {
  return {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {"name": name},
        "geometry": {
          "type": "Point",
          "coordinates": [
            long,
            lat
          ]
        }
      }
    ]
  }
};

module.exports = {
  registerNewUser(data, response) {
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
  },
  addHive(data, response) {
    client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('hives');
      const recordToSave = {
        userId: data.userId,
        geojson: makeGeoJSON(data.name, data.lat, data.long),
        issues: []
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
  updateHive(data, response) {
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
  },
  getHives(data, response) {
    return client.connect(() => {
      const db = client.db(dbName);
      const collection = db.collection('hives');
      collection.find().toArray(function(err, items) {
        if (err) {
          response({'error': err});
        } else {
          response(items);
        }
      });
    });
  }
};
