![kcapp logo](https://raw.githubusercontent.com/kcapp/frontend/master/public/images/logo.png)
# announcer
Simple `node` script which listens for certain events from `socket.io` and announce them in a slack channel

## Install
1. Clone repository `git clone https://github.com/kcapp/enhancements.git`
2. Install all node dependencies `npm install`
4. Run with `ANNOUNCE=true SLACK_CHANNEL=<channel> SLACK_KEY=<key> DEBUG=kcapp* npm start`

### Service
To run this as a service see [kcapp-announcer.service](https://github.com/kcapp/services/blob/master/kcapp-announcer.service)
