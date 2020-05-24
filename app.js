const express = require('express');
const app = express();
const cors = require('cors');
const port = 3000;
const Mongo = require('./mongoAPI');
const bodyParser = require('body-parser');

app.use(cors());
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(function (req, res, next) {
  if (req.headers.authorization === process.env.API_KEY) {
    next()
  } else {
    res.send({'error': 'Unauthorized'})
  }
});

app.get('/', (req, res) => res.send('Hello World!'));

app.get('/apiaries', (req, res) => {
  Mongo.getApiaries(req, (results) => res.send(results))
});
app.post('/addUser', (req, res) => {
  Mongo.addUser(req.body, (results) => res.send(results))
});

app.post('/addApiary', (req, res) => {
  Mongo.addApiary(req.body, (results) => res.send(results))
});

app.post('/addHive', (req, res) => {
  Mongo.addHive(req.body, (results) => res.send(results))
});

// app.post('/updateHive', (req, res) => {
//   Mongo.updateHive(req.body, (results) => res.send(results))
// });

app.post('/addSwarm', (req, res) => {
  Mongo.addSwarm(req.body, (results) => res.send(results))
});

app.get('/getSwarms', (req, res) => {
  Mongo.getSwarms(req.body, (results) => res.send(results))
});

app.post('/claimSwarm', (req, res) => {
  Mongo.claimSwarm(req.body, (results) => res.send(results))
});

app.post('/unclaimSwarm', (req, res) => {
  Mongo.unclaimSwarm(req.body, (results) => res.send(results))
});

app.listen(process.env.PORT || 5000, () => console.log(`Example app listening at http://localhost:${port}`));
