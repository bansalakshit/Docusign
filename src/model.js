const mongoose = require('mongoose')
const Schema = mongoose.Schema
const docusignSchema = new Schema({
    envelopeId: {
        type: String,
        required: true
    },
    statusDateTime: {
        type: String,
        required: true
    },
    uri: {
        type: String,
        required: true
    },
    documentId: {
        type: Number,
        required: true
    },
})

module.exports = mongoose.model('createEnvelopes' , docusignSchema);