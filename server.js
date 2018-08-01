require('dotenv').config();

const express = require('express');
const Eureka = require('eureka-js-client').Eureka;
const multer  = require('multer');
const fileSystem = require('fs');
const crypto = require('crypto');
const mime = require('mime');
const bodyParser = require('body-parser');

const {ObjectId, MongoClient} = require('mongodb');

const app = express();

let stockDb = null;

const client = new Eureka({
  instance: {
    app: 'stock-metadata',
    instanceId: 'stock-metadata',
    hostName: 'localhost',
    ipAddr: '127.0.0.1',
    port: {
      '$': process.env.PORT,
      '@enabled': 'true',
    },
    vipAddress: 'stock-metadata',
    dataCenterInfo: {
      '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
      name: 'MyOwn',
    },
  },
  eureka: {
    host: process.env.EUREKA_HOST,
    port: process.env.EUREKA_PORT,
    servicePath: '/eureka/apps/'
  },
});

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype));
    });
  }
});

const upload = multer({ storage: storage });

app.use(bodyParser.urlencoded({extended: true}));

app.get('/imagelist/product/:productId', (req, res) => {
  const {productId} = req.params;
  stockDb.collection('product_pictures').find({productId}).toArray((err, productPictures) => {
    res.send(productPictures.map(pp => pp._id));
  });
});

app.get('/images/product/:productId/:pictureId', (req, res) => {
  const {productId, pictureId} = req.params;
  const pictureIdDb = {_id: new ObjectId(pictureId)};
  stockDb.collection('product_pictures').findOne(pictureIdDb, (err, productPicture) => {
    if (productPicture) {
      res.sendFile(__dirname + '/uploads/' + productPicture.filename);
    } else {
      res.status(400).send(null);
    }
  });
});

app.get('/images/product/:productId', (req, res) => {
  const {productId} = req.params;
  stockDb.collection('product_pictures').find({productId}).toArray((err, productPictures) => {
    res.sendFile(__dirname + '/uploads/' + productPictures[0].filename);
  });
});

app.post('/images/product/:productId', upload.single('image'), (req, res) => {
  const {productId} = req.params;
  stockDb.collection('product_pictures').insert({productId, filename: req.file.filename}, (err, result) => {
    return res.send(null);
  });
});

app.delete('/images/product/:productId/:pictureId', (req, res) => {
  const {pictureId} = req.params;
  const pictureIdDb = {_id: new ObjectId(pictureId)};
  stockDb.collection('product_pictures').remove(pictureIdDb);
  return res.send(null);
});

const port = process.env.PORT;
app.listen(port, () => {
  client.start(error => console.log("connected to eureka ", error));
  const db = process.env.MONGO_CONNECTION_STRING;
  MongoClient.connect(db, (err, database) => {
    console.log("connected to db", err);
    stockDb = database.db('stockdb');
  });
  console.log("Listening on port", port);
});
