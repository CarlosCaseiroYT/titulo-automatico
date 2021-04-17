const express = require('express')
require('dotenv').config()

const { google } = require('googleapis')

const OAuth2 = google.auth.OAuth2

async function start() {
    const webServer = await startServer()
    const oauthClient = await createOauthClient()
    await requestUserConsent()
    const authToken = await waitForUserConsent()
    await requestGoogleForAccessTokens()
    setGlobalAuthentication()
    await stopServer()
    startTitleUpdating()

    async function startServer() {
        return new Promise((resolve, reject) => {
            const app = express()

            const port = process.env.PORT || 5000

            const server = app.listen(port, () => {
                console.log(`Please go to http://localhost:${port}`)
                resolve({server, app})
            })
        })
    }

    async function createOauthClient() {
        const oauthClient = new OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT
        )

        return oauthClient
    }

    async function requestUserConsent() {
        const consentUrl = oauthClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/youtube']
        })

        webServer.app.get('/', (request, response) => {
            response.send(`<p>Give your consent on ${consentUrl}</p>`)
        })
    }

    async function waitForUserConsent() {
        return new Promise((resolve, reject) => {
            webServer.app.get('/callback', (request, response) => {
                const authToken = request.query.code
                response.send('<p>Done. Close this tab</p>')
                resolve(authToken)
            })
        })
    }

    async function requestGoogleForAccessTokens() {
        return new Promise((resolve, reject) => {
            oauthClient.getToken(authToken, (error, tokens) => {
                if (error) reject(error)

                oauthClient.setCredentials(tokens)
                resolve()
            })
        })
    }

    function setGlobalAuthentication() {
        google.options({
            auth: oauthClient
        })
    }

    async function stopServer() {
        return new Promise((resolve, reject) => {
            webServer.server.close(() => {
                resolve()
            })
        })
    }

    function startTitleUpdating() {
        setInterval(() => {
            updateTitle()
        }, 7.5 * 60 * 1000)
    }

    async function updateTitle() {
        const youtube = google.youtube({
            version: 'v3',
            auth: oauthClient
        })

        const videoId = 'fqZz4JcFpzk'
        const channelId = 'UCVz5XDLBctGc7Ip4CwXqomA'

        const videoResult = await youtube.videos.list({
            id: videoId,
            part: 'snippet'
        })
        const video = videoResult.data.items[0]

        const channelResult = await youtube.channels.list({
            id: channelId,
            part: 'statistics'
        })
        const channel = channelResult.data.items[0]

        const { subscriberCount } = channel.statistics

        const newTitle = `O canal tem ${subscriberCount} inscritos`

        video.snippet.title = newTitle

        const updateVideoResult = await youtube.videos.update({
            requestBody: video,
            part: 'snippet'
        })

        console.log(updateVideoResult.status)
    }
}

start()