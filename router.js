const express = require('express')
const components = require('./src/components')
const router = express.Router()

router.get('/create', components.sendEnvelopeController)
router.get('/login', components.login)
router.get('/getEnvelopes', components.getListEnvelopes)
router.get('/getRecepients', components.getEnvelopeRecipients)
router.get('/getPdf', components.getPdf)
router.get('/abc', components.webhook)

module.exports = router