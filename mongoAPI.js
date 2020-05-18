require('dotenv').config();
const h3 = require("h3-js");
const { v4: uuidv4 } = require('uuid');
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
        "properties": {"name": name, "hiveId": uuidv4()},
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
      const h3Cell = h3.geoToH3(data.lat, data.long, 6);
      const recordToSave = {
        userId: data.userId,
        geojson: makeGeoJSON(data.name, data.lat, data.long),
        h3: h3Cell,
        h3Geom: h3.h3ToGeoBoundary(h3Cell, true),
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
      const {hiveId} = data;
      const db = client.db(dbName);
      const collection = db.collection('hives');
      return collection.findOneAndUpdate({hiveId: hiveId},
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
