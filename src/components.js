const docusign = require('docusign-esign')
const path = require('path')
const fs = require('fs')
const unirest = require('unirest')
const base64 = require('base64topdf')
const basePath = 'https://demo.docusign.net/restapi'
const NodeRSA = require('node-rsa');
const key = new NodeRSA({ b: 512 });
const IPFS = require('ipfs');
const cron = require('node-cron');
const docusignSchema = require('./model')

cron.schedule('2 * * * * *', () => {
  const accountId = process.env.AccountId;
  const authObj = {
    'Username': process.env.Username,
    'Password': process.env.Password,
    'IntegratorKey': process.env.IntegratorKey
  }
  const demo = docusignSchema.find((err, data) => {
    if (data) {
      data.map(async (value) => {
        const uri = `${basePath}//v2.1/accounts/${accountId}/envelopes/${value.envelopeId}`
        const result = await unirest.get(uri, {
          "X-DocuSign-Authentication": JSON.stringify(authObj),
          "Content-Type": "application/json",
        })
        console.log(result.body.envelopeId + '  ' + result.body.status)
          // console.log(result.body.envelopeId + '  ' + value.envelopeId)
        if (result && result.body.status == 'completed') {
          const uri = `https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes/${result.body.envelopeId}/documents/${value.documentId}`
          const response = await unirest.get(uri, {
            "X-DocuSign-Authentication": JSON.stringify(authObj),
            "Content-Type": "application/json",
            "Content-Transfer-Encoding": "base64"
          })
          const text = response.body;
          const encrypted = key.encrypt(text, 'base64');                                                                           // Encrypt the file
          const node = await IPFS.create();
          const files = await node.add(encrypted);                                                                                 // Store the encryped file in the IPFS and generate the key
          // await node.stop()
          console.log('IPFS token----->', files[0].hash)
          await value.remove()
          console.log(result.body.envelopeId + ' removed..')
          const data = await node.cat(files[0].hash);                                                                              // Retreive the data from the key
          const decrypted = key.decrypt(data.toString(), 'utf8');                                                                  // Decrypt the file
          const decodedBase64 = base64.base64Decode(decrypted, './docs/docusign.pdf');
          await node.stop()
        }
      })
    }
  })
});

// const dsConfig = {
//   clientId: process.env.IntegratorKey,
//   impersonatedUserGuid: '9508563',
//   signerEmail: 'akshitbansal719@gmail.com',
//   signerName: 'Akshit Bansal',
//   privateKey: 'bd7fc9b3-a18f-428b-9ac9-3f9d90af5d78',
//   targetAccountId: '8bee385e-d430-4a18-a249-4f6e195a9491',
//   authServer: 'account-d.docusign.com',
//   oAuthConsentRedirectURI: 'https://www.docusign.com'
// }

let count = 1
exports.sendEnvelopeController = async (req, res) => {
  let a = 1
  const accessToken = req.body.accessToken
  const accountId = process.env.AccountId;
  const recipients = req.body.recipients;

  const fileName = '../demo_documents/World_Wide_Corp_lorem.pdf';
  const apiClient = new docusign.ApiClient();

  // const jwtLifeSec = 10 * 60,
  //   scopes = "signature";
  // console.log(1)
  // apiClient.setOAuthBasePath(dsConfig.authServer);
  // console.log(1)
  // const result = await apiClient.requestJWTUserToken(dsConfig.clientId,
  //   dsConfig.impersonatedUserGuid, scopes, dsConfig.privateKey,
  //   jwtLifeSec);
  // console.log(1)
  // const expiresAt = moment().add(result.body.expires_in, 's');
  // console.log(1)
  // console.log(result.body.access_token)

  apiClient.setBasePath(basePath);
  apiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
  docusign.Configuration.default.setDefaultApiClient(apiClient);

  const envDef = new docusign.EnvelopeDefinition();
  envDef.emailSubject = 'Please sign this document sent from the Node example';
  envDef.emailBlurb = 'Please sign this document sent from the Node example.'

  const pdfBytes = fs.readFileSync(path.resolve(__dirname, fileName))
    , pdfBase64 = pdfBytes.toString('base64');
  const doc = docusign.Document.constructFromObject({
    documentBase64: pdfBase64,
    fileExtension: 'pdf',
    name: 'Sample document', documentId: count
  });

  envDef.documents = [doc];

  const array = []

  let recipientId = 1
  for (let value of recipients) {
    const signer = docusign.Signer.constructFromObject({
      name: value.signerName,
      email: value.signerEmail, routingOrder: 1, recipientId
    });

    const signHere = docusign.SignHere.constructFromObject({
      documentId: count,
      pageNumber: value.signHere.pageNumber, recipientId, tabLabel: 'SignHereTab',
      xPosition: value.signHere.xPosition, yPosition: value.signHere.yPosition
    });

    signer.tabs = docusign.Tabs.constructFromObject({ signHereTabs: [signHere] });
    recipientId++;
    array.push(signer)
  }

  envDef.recipients = docusign.Recipients.constructFromObject({ signers: array });
  envDef.status = 'sent';

  let envelopesApi = new docusign.EnvelopesApi()
    , results
    ;

  try {
    results = await envelopesApi.createEnvelope(accountId, { 'envelopeDefinition': envDef })
    results.documentId = count
  } catch (e) {
    let body = e.response && e.response.body;
    if (body) {
      res.send(`<html lang="en"><body>
                  <h3>API problem</h3><p>Status code ${e.response.status}</p>
                  <p>Error message:</p><p><pre><code>${JSON.stringify(body, null, 4)}</code></pre></p>`);
    } else {
      throw e;
    }
  }
  const dataobj = {
    envelopeId: results.envelopeId,
    statusDateTime: results.statusDateTime,
    uri: results.uri,
    documentId: results.documentId
  }
  let docusignData = new docusignSchema(dataobj)
  docusignData.save()
  if (results) {
    count++;
    res.send(results);
  }
}
exports.login = async (req, res) => {
  const authObj = {
    'Username': process.env.Username,
    'Password': process.env.Password,
    'IntegratorKey': process.env.IntegratorKey
  }

  const uri = `${basePath}/v2.1/login_information`
  const result = await unirest.get(uri, {
    "X-DocuSign-Authentication": JSON.stringify(authObj),
    "Content-Type": "application/json",
  })
  if (result) {
    res.status(200).send(result)
  }
}

exports.getListEnvelopes = async (req, res) => {
  const accountId = process.env.AccountId;
  const envelopeId = req.body.envelopeId;
  const authObj = {
    'Username': process.env.Username,
    'Password': process.env.Password,
    'IntegratorKey': process.env.IntegratorKey
  }

  const uri = `${basePath}//v2.1/accounts/${accountId}/envelopes/${envelopeId}`
  const result = await unirest.get(uri, {
    "X-DocuSign-Authentication": JSON.stringify(authObj),
    "Content-Type": "application/json",
  })
  if (result) {
    res.status(200).send(result)
  }
}

exports.getEnvelopeRecipients = async (req, res) => {
  const accountId = process.env.AccountId;
  const envelopeId = req.body.envelopeId;
  const authObj = {
    'Username': process.env.Username,
    'Password': process.env.Password,
    'IntegratorKey': process.env.IntegratorKey
  }

  const uri = `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`
  const result = await unirest.get(uri, {
    "X-DocuSign-Authentication": JSON.stringify(authObj),
    "Content-Type": "application/json",
  })
  if (result) {
    res.status(200).send(result)
  }
}

exports.getPdf = async (req, res) => {
  const accountId = process.env.AccountId;
  const envelopeId = req.body.envelopeId;
  const documentId = req.body.documentId;

  const obj = {
    'Username': process.env.Username,
    'Password': process.env.Password,
    'IntegratorKey': process.env.IntegratorKey
  }

  const uri = `https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/${documentId}`
  const result = await unirest.get(uri, {
    "X-DocuSign-Authentication": JSON.stringify(obj),
    "Content-Type": "application/json",
    "Content-Transfer-Encoding": "base64"
  })
  const text = result.body;
  const encrypted = key.encrypt(text, 'base64');                                                                           // Encrypt the file
  const node = await IPFS.create();
  const files = await node.add(encrypted);                                                                                 // Store the encryped file in the IPFS and generate the key
  //   await node.stop()                                                                                                   // We have to stop node to recreate IPFS.
  //   const node = await IPFS.create(); 
  const data = await node.cat(files[0].hash);                                                                              // Retreive the data from the key
  const decrypted = key.decrypt(data.toString(), 'utf8');                                                                  // Decrypt the file
  const decodedBase64 = base64.base64Decode(decrypted, './docs/docusign.pdf');                                             // Download Pdf
  res.status(200).send('Pdf downloaded successfully..')
}

exports.webhook = async (req, res) => {
  // let envelopeDefinition = new docusign.EnvelopeDefinition();
  // let eventNotification = new docusign.EventNotification();
  // eventNotification.url = 'http://bridgetest.blockstartdsp.com/api/v1/create';
  // eventNotification.requireAcknowledgment = 'true';
  // eventNotification.includeDocuments = 'true';
  // eventNotification.loggingEnabled = 'true';
  // let envelopeEvents = [];
  // let envelopeEvent = new docusign.EnvelopeEvent();
  // envelopeEvent.envelopeEventStatusCode = 'completed';
  // envelopeEvent.includeDocuments = 'true';
  // envelopeEvents.push(envelopeEvent);
  // eventNotification.envelopeEvents = envelopeEvents;
  // envelopeDefinition.eventNotification = eventNotification;
}