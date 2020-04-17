const express = require('express');
const app = express();
const port = 3000;
const Mongo = require('./mongoAPI');
const bodyParser = require('body-parser');

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

app.post('/registerNewUser', (req, res) => {
  Mongo.registerNewUser(req.body, (results) => res.send(results))
});

app.post('/addHive', (req, res) => {
  Mongo.addHive(req.body, (results) => res.send(results))
});

app.post('/updateHive', (req, res) => {
  Mongo.updateHive(req.body, (results) => res.send(results))
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
