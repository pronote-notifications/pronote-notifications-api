const firebase = require('firebase-admin')
const fetch = require('node-fetch')
const config = require('../config.json')

class FirebaseService {
    constructor () {
        this.serverKey = config.googleCloudMessagingServerKey
        this.app = firebase.initializeApp({
            credential: firebase.credential.cert(config.serviceAccountKey)
        })
    }

    verifyToken (token) {
        return new Promise((resolve) => {
            fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                    Authorization: `key=${this.serverKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    registration_ids: [token]
                })
            }).then((res) => {
                res.json().then((data) => {
                    resolve(!(data.results[0].error === 'InvalidRegistration'))
                })
            })
        })
    }

    sendNotification (notificationData, notificationType, tokens) {
        firebase.messaging().sendMulticast({
            data: {
                type: notificationType
            },
            notificationData,
            tokens
        }).then((response) => {
            console.log(response.responses.map((e) => e.error))
        })
    }
}

module.exports = FirebaseService
