'use strict'

const express = require('express')
const axios = require('axios')
const co = require('co')
const _ = require('lodash')

const app = express()
const pkg = require('./package.json')

const port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000
const ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

const instance = axios.create({
  baseURL: 'https://od-api.oxforddictionaries.com:443/api',
  headers: {
    app_id: process.env.APP_ID,
    app_key: process.env.APP_KEY
  }
})

app.get('/status', function (req, res) {
  res.json(pkg)
})

const router = express.Router()
router.get('/words/:word', function (req, res) {
  const word = req.params.word

  // TODO(fang): throw if word is not found

  co(function * () {
    let wordResult = {}

    // issue the API call
    const result = yield instance.get(`/v1/entries/en/` + word)
      .then(res => res.data)

    const apiResult = _.head(_.get(result, 'results', []))
    if (apiResult) {
      wordResult.id = apiResult.id

      const lexicalEntries = _.get(apiResult, 'lexicalEntries', [])
      const headEntry = _.head(lexicalEntries)
      if (headEntry) {
        wordResult.category =
        wordResult.language = headEntry.language

        const pronounciation = _.head(_.get(headEntry, 'pronunciations', []))
        if (pronounciation) {
          wordResult.pronounciation = Object.assign(pronounciation, {
            id: `${word}-audio`
          })
        }
      }

      const wordDefintions = []
      lexicalEntries.forEach(lexicalEntry => {
        const partOfSpeech = _.upperCase(_.get(lexicalEntry, 'lexicalCategory', ''))

        const entries = _.get(lexicalEntry, 'entries', [])
        entries.forEach(entry => {
          const senses = _.get(entry, 'senses', [])
          senses.forEach(sense => {
            const definitions = _.get(sense, 'definitions', [])
            if (definitions.length > 0) {
              const [definition] = definitions

              wordDefintions.push({
                id: sense.id,
                definition: definition,
                partOfSpeech
              })
            }
          })
        })
      })

      wordResult.definitions = wordDefintions
    }

    res.json({ result: wordResult })
  })
})

app.use('/v1', router)

app.listen(port, ip)
console.log('Server running on http://%s:%s', ip, port)

module.exports = app
