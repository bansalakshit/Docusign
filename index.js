const express = require('express')
const bodyParser = require('body-parser')
const router = require('./router')
const mongoose = require('mongoose')
require('dotenv').config()

const app = express()
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(router)

app.listen(5000)

mongoose.connect('mongodb://localhost:27017/docusign', { useNewUrlParser: true , useCreateIndex: true, useUnifiedTopology: true }, (err, db) => {
    if (err) {
        console.log('Mongodb Error');
    }
    else {
        console.log("Database created...");
    }
})
