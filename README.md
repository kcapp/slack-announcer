![kcapp logo](https://raw.githubusercontent.com/wiki/kcapp/frontend/images/logo/kcapp_plus_slack.png)
# slack-announcer
Simple `node` script listening for certain events on `socket.io` and announce them in a [Slack](https://slack.com/) channel

## Example
#### Match Started
Once a official match starts, a message will be posted showing the two players and a link to spectate the match

![Match Started](https://raw.githubusercontent.com/wiki/kcapp/frontend/images/announcer/announcer_started.png)

#### Match Thread
For each leg finishing, a message will be posted to the thread of the original message, showing who won the leg, with what checkout and after how many darts

![Match Thread](https://raw.githubusercontent.com/wiki/kcapp/frontend/images/announcer/announter_thread.png)

#### Match Ended
Once the match finishes, the original messag will be updated with the final result, as well as a link to the match result

![Match Ended](https://raw.githubusercontent.com/wiki/kcapp/frontend/images/announcer/announter_result.png)

## Install
1. Install all dependencies `npm install`
2. Run with
```
ANNOUNCE=true SLACK_CHANNEL=<channel> SLACK_KEY=<key> DEBUG=kcapp* npm start
# ... or
SLACK_CHANNEL=<channel> SLACK_KEY=<key> npm run prod
# ... or for development (will not actually post anything)
npm run dev
```

### Configuration
To make the `slack-announcer` work it must be linked to a Slack app, see below section for Slack setup

Configuration is done via the following environment variables
* `ANNOUNCE`: By default no messages are posted, so this must be set to `true` to post. If not messages will only be logged out for debugging
* `SLACK_CHANNEL`: ID of the Slack channel to post to
* `SLACK_KEY`: Bot User `OAuth Access Token`
* `DEBUG`: value is passed to [debug](https://github.com/visionmedia/debug) module to specify which packages should be logged

If you are running on non-standard setup, you might also need to specify
* `API_URL`: By default it assumes the API is running on `http://localhost:8001`
* `GUI_URL`: By default it assumes the GUI is running on `http://localhost:3000` , this is used for all links posted on Slack

### Service
To run this as a service see [kcapp-announcer.service](https://github.com/kcapp/services/blob/master/kcapp-announcer.service)

## Slack setup
1. Create a new [Slack App](https://api.slack.com/apps/) with the following `App Manifest`
```
display_information:
  name: kcapp
  description: Dart Scoring Application
  background_color: "#2c2d30"
features:
  bot_user:
    display_name: kcapp
    always_online: true
oauth_config:
  scopes:
    bot:
      - channels:read
      - chat:write
      - groups:read
      - reactions:read
      - reactions:write
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```
2. Install the app into your workspace