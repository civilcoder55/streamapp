# streamingapp

# Nodejs Streaming site

<a href="http://stream.backenddev.co"><img src="https://stream.backenddev.co/img/logo.svg"></a>

> this project is a simple site written in node.js with express.js framework , main task of this project is to handle downloading & transcoding & streaming files

[stream.backenddev.co](https://stream.backenddev.co)



[<img src="https://backenddev.co/img/streamingapp.mp4" width="50%">](https://backenddev.co/img/streamingapp.mp4)
this app hosted via nginx on linux server as revers proxy & node.js server via pm2 as main server
static files served via node.js express static

## Main Features

- **authentication system**

  - sessions/cookies
  - register/login
  - change password
  - reset password using jwt tokens

- **subscriptions**

  - monthly plans
  - credit card payments using stripe api

- sending emails using sendgrid api

- **streaming media**

  - hls protocol
  - adaptive bitrate streaming with 4 qualities
  - simple stream authentication using cookies

- **backgroud tasks**

  - schedule background tasks using kue and automatically process them one by one
  - 1st downloading media file using torrent added by admin
  - 2nd transcode downloaded media to ts/m3u8 (hls) with 1st quality of 240p
  - 3rd transcode downloaded media to ts/m3u8 (hls) with 2nd quality of 360p
  - 4th transcode downloaded media to ts/m3u8 (hls) with 2nd quality of 720p
  - 5th transcode downloaded media to ts/m3u8 (hls) with 2nd quality of 1080p
  - 6th extracting screenshots of the media file to show it on site as preview

## Built With

- [expressjs](https://expressjs.com/) - The web framework used
- [kue](https://www.npmjs.com/package/kue) - background tasks Management
- [webtorrent](https://www.npmjs.com/package/webtorrent) - Used to download torrent files
- Mysql database

## Authors

- **Civilcoder** - [civilcoder](https://backenddev.co)

## TO DO

- refactor some code
- adding some comments
