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
        return `T-${dart.value}`;
    } else if (dart.multiplier === 2) {
        return `D-${dart.value}`;
    }
    return dart.value;
}


exports.getLink = (part, text) => {
    return `${this.url}${part}|${text}`;
}

exports.getLegResultLink = (leg, legNum) => {
    return this.getLink(`/legs/${leg.id}/result`, legNum);
}

exports.getMatchSpectateLink = (match) => {
    return this.getLink(`/matches/${match.id}/spectate`, "Spectate");
}

exports.getMatchResultLink = (match) => {
    return this.getLink(`/matches/${match.id}`, "Result");
}

exports.getPlayerStatisticsLink = (player) => {
    return this.getLink(`/players/${player.player_id}/statistics`, player.player_name);
}

/**
 * Get Slack template to post when a new match starts
 * @param {object} match - Match object
 * @param {array} players - Array of home and away players
 * @returns Slack template
 */
exports.matchStarted = (match, players) => {
    const home = players[0];
    const away = players[1];

    const text = `:dart: <${this.getPlayerStatisticsLink(home)}> vs. <${this.getPlayerStatisticsLink(away)}> is about to start. <${this.getMatchSpectateLink(match)}>`;
    return {
        "text": "",
        "channel": this.channel,
        "attachments": [
            {
                "fallback": "Official Match",
                "author_name": "Official Match Started :trophy:",
                "title": `${match.tournament.tournament_group_name}`,
                "text": text,
                "mrkdwn_in": [ "text" ]
            }
        ]
    };
}

/**
 * Get Slack template to post when a new match ends
 * @param {object} match - Match object
 * @param {array} players - Array of home and away players
 * @returns Slack template
 */
exports.matchEnded = (match, players) => {
    const home = players[0];
    const away = players[1];

    const homeWins = home.wins ? home.wins : 0;
    const awayWins = away.wins ? away.wins : 0;

    const text = `:checkered_flag: <${this.getPlayerStatisticsLink(home)}> ${homeWins} - ${awayWins} <${this.getPlayerStatisticsLink(away)}>. <${this.getMatchResultLink(match)}>`;
    return {
        "text": "",
        "channel": this.channel,
        "attachments": [
            {
                "fallback": "Official Match",
                "author_name": "Official Match Finished :trophy:",
                "title": `${match.tournament.tournament_group_name}`,
                "text": text,
                "mrkdwn_in": [ "text" ]
            }
        ]
    };
}

/**
 * Get Slack template to post when a leg is finished
 * @param {string} thread - Slack thread id
 * @param {array} players - Array of home and away players
 * @param {object} match - Match object
 * @param {object} leg - Leg Object
 * @param {object} finalThrow - Throw object
 * @returns Slack template
 */
exports.legFinished = (thread, players, match, leg, finalThrow) => {
    const winner = players.find( (player) => {
        return player.player_id === leg.winner_player_id;
    }).player.first_name;
    const legNum = match.legs.length - 1 + (["st", "nd", "rd"][((match.legs.length - 1 + 90) % 100 - 10) % 10 - 1] || "th");

    const first = finalThrow.first_dart;
    const second = finalThrow.second_dart;
    const third = finalThrow.third_dart;
    const checkout = first.value * first.multiplier + second.value * second.multiplier + third.value * third.multiplier;
    const dartsThrown = leg.visits[leg.visits.length - 1].darts_thrown;

    let checkoutDarts = `\`${formatThrow(first)}\` \`${formatThrow(second)}\` \`${formatThrow(third)}\``;
    if (checkout - first.value * first.multiplier === 0) {
        checkoutDarts = `\`${formatThrow(first)}\``;
    } else if (checkout - first.value * first.multiplier - second.value * second.multiplier === 0) {
        checkoutDarts = `\`${formatThrow(first)}\` \`${formatThrow(second)}\``;
    }

    return {
        "text": `${winner} wins the <${this.getLegResultLink(leg, legNum)} leg> with a ${checkout} (${checkoutDarts}) checkout after ${dartsThrown} darts!`,
        "thread_ts": `"${thread}"`,
        "channel": this.channel
    };
}

/**
 * Get Slack template to post about unplayed tournament matches
 * @param {object} tournament - Tournament object
 * @param {array} matches - List of all tournament matches
 * @param {map} players - Map of all players
 * @param {map} groups - Map of all groups in the tournament
 * @returns Slack template
 */
exports.tournamentMatches = (tournament, matches, players, groups) => {
    const msg = {
        text: "Pending Official Matches :trophy:",
        channel: this.channel,
        attachments: []
    }

    for (const groupId in matches) {
        const group = matches[groupId];

        const newMatches = _.filter(group, (match) => {
            return !match.is_finished && moment(match.created_at).isSameOrBefore(moment(), 'day');
        });
        if (newMatches.length === 0) {
            continue;
        }

        let groupMatches = "";
        for (let i = newMatches.length - 1; i >= 0; i--) {
            const match = newMatches[i];

            const home = players[match.players[0]];
            const homePlayerName = home.slack_handle ? `<${home.slack_handle}>` : home.name;
            const away = players[match.players[1]];
            const awayPlayerName = away.slack_handle ? `<${away.slack_handle}>` : away.name;
            const week = moment(match.created_at).diff(moment(tournament.start_time), "weeks") + 1;
            groupMatches += `Week ${week}: ${homePlayerName} - ${awayPlayerName}\n`;
        }

        msg.attachments.push({
            "fallback": `${groups[groupId].name} Pending Matches`,
            "author_name": "",
            "title": `${groups[groupId].name}`,
            "text": `${groupMatches}`,
            "mrkdwn_in": [ "text" ]
        });
    }
    return msg;
}

module.exports = (url, channel) => {
    this.url = url;
    this.channel = channel;
    return this;
};
