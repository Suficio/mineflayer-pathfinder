'use strict';

const Vec3 = require('vec3');
const defaultNeighborSearch = require('./Neighbors/defaultNeighborSearch.js');
const compiledNeighborSearch = require('./Neighbors/compiledNeighborSearch.js');

module.exports = function(bot)
{
    // The greatest speedup that can be achieved at this point would be by optimizing the CheckBlockConditions function. It was purposefully built to be dynamic however
    // a hardcoded implementation could work so much much faster. That being said the successorconditions.json is not optimized either, one could implement a top
    // to bottom search considering the fact that once a block at the top is found, none of the blocks at the bottom will be accessible.

    // All in all the user is encouraged to supply his own successor or predecessor functions.

    bot.pathfinder = {};
    bot.pathfind = bot.pathfinder;
    bot.pathfinder.ENUMPathfinder = {ASTAR: 0, DLITE: 1, LPASTAR: 2};
    bot.pathfinder.ENUMStatus = {Complete: 0, Incomplete: 1};

    // Default successor and predecessor implementation

    bot.pathfinder.getSuccessors = function() {return [];};
    bot.pathfinder.getPredecessors = function() {return [];};

    defaultNeighborSearch(bot);
    // compiledNeighborSearch(bot);

    // Native getBlock implementation too slow for this case

    let blocks;
    bot.pathfinder.getBlock = function(absolutePoint)
    {
        if (bot.version) // bot.version may not be yet initialized when run
        {
            blocks = require('minecraft-data')(bot.version).blocks;

            this.getBlock = function(absolutePoint)
            {
                // Get block cannot correctly identify the ammount of layers of snow at any block
                const key = new Vec3(euclideanMod(absolutePoint.x, 16), absolutePoint.y, euclideanMod(absolutePoint.z, 16));
                const column = bot._chunkColumn(absolutePoint.x - key.x, absolutePoint.z - key.z);
                if (!column) return undefined;

                const block = blocks[column.getBlockType(key)];
                block.coordinates = absolutePoint;

                return block;
            };

            return this.getBlock(absolutePoint);
        }
        else
        {
            console.error(
                'ERROR Pathfinder: Bot not yet initialized when getBlock was run,',
                'ensure that bot.version is initialized'
            );
        }
    };

    // Main function to interact

    bot.pathfinder.lastState = undefined;
    bot.pathfinder.to = function(Start, End, ENUMPathfinder)
    {
        if (!ENUMPathfinder || ENUMPathfinder === bot.pathfinder.ENUMPathfinder.ASTAR)
            bot.pathfinder.lastState = require('./Pathfinders/ASTAR.js')(bot, Start.floored(), End.floored());

        else if (ENUMPathfinder === bot.pathfinder.ENUMPathfinder.DLITE)
            bot.pathfinder.lastState = require('./Pathfinders/DLITE.js')(bot, Start.floored(), End.floored());

        else if (ENUMPathfinder === bot.pathfinder.ENUMPathfinder.LPASTAR)
            bot.pathfinder.lastState = require('./Pathfinders/LPASTAR.js')(bot, Start.floored(), End.floored());

        bot.pathfinder.lastState.then(function(returnState)
        {
            bot.pathfinder.lastState = returnState;
        });

        return bot.pathfinder.lastState;
    };

    // Passes block updates to last pathfinder, assumes only one is active
    // Prevents multiple event listeners being registered by each new pathfinder.

    bot.on('blockUpdate', function(block)
    {
        if (
            bot.pathfinder.lastState !== undefined && !(bot.pathfinder.lastState instanceof Promise) &&
            bot.pathfinder.lastState.path.updateState !== undefined
        )
            bot.pathfinder.lastState.path.updateState(block.position);
    });

    // Setup variables

    bot.pathfinder.MAX_EXPANSIONS = 10000;
    bot.pathfinder.HEURISTIC = function(p1, p2) {return p1.distanceTo(p2);};
    bot.pathfinder.COST = bot.pathfinder.HEURISTIC;
};

function euclideanMod(numerator, denominator)
{
    const result = numerator % denominator;
    return result < 0 ? result + denominator : result;
}
