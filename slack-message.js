exports.matchStarted = (match, players) => {
    var homePlayer = players[0];
    var awayPlayer = players[1];

    return {
        "text": "",
        "channel": `"${this.channel}"`,
        "attachments": [
            {
                "fallback": "Official Match",
                "author_name": "Official Match Started :trophy:",
                "title": `${match.tournament.tournament_group_name}`,
                "text": `:dart: <${this.url}/players/${homePlayer.player_id}/statistics|${homePlayer.player_name}> vs. <${this.url}/players/${awayPlayer.player_id}/statistics|${awayPlayer.player_name}> is about to start. <${this.url}/matches/${match.id}/spectate|Spectate>`,
                "mrkdwn_in": [ "text" ]
            }
        ]
    };
}

exports.matchEnded = (match, players) => {
    var homePlayer = players[0];
    var awayPlayer = players[1];

    var homePlayerWins = homePlayer.wins ? homePlayer.wins : 0;
    var awayPlayerWins = awayPlayer.wins ? awayPlayer.wins : 0;

    return {
        "text": "",
        "channel": `"${this.channel}"`,
        "attachments": [
            {
                "fallback": "Official Match",
                "author_name": "Official Match Finished :trophy:",
                "title": `${match.tournament.tournament_group_name}`,
                "text": `:checkered_flag: <${this.url}/players/${homePlayer.player_id}/statistics|${homePlayer.player_name}> ${homePlayerWins} - ${awayPlayerWins} <${this.url}/players/${awayPlayer.player_id}/statistics|${awayPlayer.player_name}>. <${this.url}/matches/${match.id}/result|Result>`,
                "mrkdwn_in": [ "text" ]
            }
        ]
    };
}

module.exports = (url, channel) => {
    this.url = url;
    this.channel = channel;
    return this;
  };