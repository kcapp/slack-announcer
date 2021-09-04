![kcapp logo](https://raw.githubusercontent.com/kcapp/frontend/master/public/images/logo.png)
# announcer
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
1. Clone repository `git clone https://github.com/kcapp/enhancements.git`
2. Install all dependencies `npm install`
3. Run with `ANNOUNCE=true SLACK_CHANNEL=<channel> SLACK_KEY=<key> DEBUG=kcapp* npm start`

### Configuration
To make the `announcer` work it must be linked to a [Slack app](https://api.slack.com/).

Configuration is done via the following environment variables
* `ANNOUNCE`: By default no messages are posted, so this must be set to `true` to post. If not messages will only be logged out for debugging
* `SLACK_CHANNEL`: ID of the Slack channel to post to
* `SLACK_KEY`: Bot User `OAuth Access Token`
* `DEBUG`: value is passed to [debug](https://github.com/visionmedia/debug) module to specify which packages should be logged

### Service
To run this as a service see [kcapp-announcer.service](https://github.com/kcapp/services/blob/master/kcapp-announcer.service)