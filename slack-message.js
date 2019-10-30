function formatThrow(dart) {
    if (dart.value == null) {
        return "";
    }
    if (dart.value === 0) {
        return "Miss";
    }
    if (dart.value === 25) {
        if (dart.multiplier === 2) {
            return "D-Bull";
        }
        return "Bull";
    }

    if (dart.multiplier === 3) {
        return "T-" + dart.value;
    } else if (dart.multiplier === 2) {
        return "D-" + dart.value;
    }
    return dart.value;
}

exports.matchStarted = (match, players) => {
    var homePlayer = players[0];
    var awayPlayer = players[1];

    return {
        "text": "",
        "channel": this.channel,
        "attachments": [
            {
                "fallback": "Official Match",
                "author_name": "Official Match Started :trophy:",
                "title": `${match.tournament.tournament_group_name}`,
                "text": `:dart: <${this.url}/players/${homePlayer.player_id}/statistics|${homePlayer.player_name}> vs. <${this.url}/players/${awayPlayer.player_id}/statistics|${awayPlayer.player_name}>. <${this.url}/matches/${match.id}/spectate|Spectate>`,
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
        "channel": this.channel,
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

exports.legFinished = (thread, players, match, leg, finalThrow) => {
    var winner = players.find( (player) => { return player.player_id == leg.winner_player_id; }).player.first_name;
    var legNum = match.legs.length + (["st", "nd", "rd"][((match.legs.length + 90) % 100 - 10) % 10 - 1] || "th");

    var first = finalThrow.first_dart;
    var second = finalThrow.second_dart;
    var third = finalThrow.third_dart;
    var checkout = first.value * first.multiplier + second.value * second.multiplier + third.value * third.multiplier;

    var checkoutDarts = "`" + formatThrow(first) + "` `" + formatThrow(second) + "` `" + formatThrow(third) + "`";
    if (checkout - first.value * first.multiplier === 0) {
        checkoutDarts = "`" + formatThrow(first) + "`";
    } else if (checkout - first.value * first.multiplier - second.value * second.multiplier === 0) {
        checkoutDarts = "`" + formatThrow(first) + "` `" + formatThrow(second) + "`";
    }
    return {
        "text": `${winner} wins the <${this.url}/legs/${leg.id}/result|${legNum} leg> with a ${checkout} (${checkoutDarts}) checkout after ${leg.darts_thrown} darts!`,
        "thread_ts": `"${thread}"`,
        "channel": this.channel
    };
}

module.exports = (url, channel) => {
    this.url = url;
    this.channel = channel;
    return this;
  };
