EventEmitter = require('events').EventEmitter;
const Vec3 = require('vec3');
const Path = require('path');

// const optVer = require('minecraft-protocol/src/version').defaultVersion;
// const blockData = require('minecraft-data')(optVer).blocks;

module.exports = function(bot)
{
    const mcData = require('minecraft-data')(bot.version);
    blocks = mcData.blocks;
    blocksByStateId = mcData.blocksByStateId;

    // The greatest speedup that can be achieved at this point would be by optimizing the CheckBlockConditions function. It was purposefully built to be dynamic however
    // a hardcoded implementation could work so much much faster. That being said the successorconditions.json is not optimized either, one could implement a top
    // to bottom search considering the fact that once a block at the top is found, none of the blocks at the bottom will be accessible.

    // All in all the user is encouraged to supply his own successor or predecessor functions.

    bot.pathfinder = new EventEmitter();
    bot.pathfinder.ENUMPathfinder = {ASTAR: 0, DLITE: 1, UDLITE: 2};
    bot.pathfinder.ENUMStatus = {Complete: 0, Incomplete: 1};

    bot.pathfinder.getSuccessors = gMS.bind(undefined, require(Path.resolve(__dirname, 'DefaultConditions/successorConditions.json')));
    bot.pathfinder.getPredecessors = gMS.bind(undefined, require(Path.resolve(__dirname, 'DefaultConditions/predecessorConditions.json')));

    // Native getBlock implementation too slow for this case
    bot.pathfinder.getBlock = function(absolutePoint)
    {
        // Get block cannot correctly identify the ammount of layers of snow at any block
        const key = Vec3(euclideanMod(absolutePoint.x, 16), absolutePoint.y, euclideanMod(absolutePoint.z, 16));
        const column = bot._chunkColumn(absolutePoint.x - key.x, absolutePoint.z - key.z);

        if (!column) return null; else return blocks[column.getBlockType(key)];
    };

    // Main function to interact
    bot.pathfinder.to = function(Start, End, ENUMPathfinder)
    {
        if (!ENUMPathfinder || ENUMPathfinder === bot.pathfinder.ENUMPathfinder.ASTAR)
            return require(Path.resolve(__dirname, 'Pathfinders/ASTAR.js'))(bot, Start.floored(), End.floored());

        else if (ENUMPathfinder === bot.pathfinder.ENUMPathfinder.DLITE)
            return require(Path.resolve(__dirname, 'Pathfinders/DLITE/DLITE.js'))(bot, Start.floored(), End.floored());

        else if (ENUMPathfinder === bot.pathfinder.ENUMPathfinder.UDLITE)
            return require(Path.resolve(__dirname, 'Pathfinders/DLITE/UDLITE.js'))(bot, Start.floored(), End.floored());
    };

    // bot.pathfind.SCAFFOLD = false;
    bot.pathfinder.MAX_EXPANSIONS = 80000; // 80000
    bot.pathfinder.HEURISTIC = function(p1, p2) {return p1.distanceTo(p2);};
    bot.pathfinder.COST = bot.pathfinder.HEURISTIC;

    function gMS(blockConditions, u)
    {
        const possiblePositions = [];
        for (let m = 0; m < 4; m++)
        {
            for (let i = 0, il = blockConditions.length; i < il; i++)
                checkBlockConditions(possiblePositions, cardinalDirectionVectors3D[m], blockConditions[i], u);
        }

        return possiblePositions;
    }

    function checkBlockConditions(possiblePositions, directionVector, blockConditions, playerPosition)
    {
        let failedCheck = false;

        for (let i = 0, il = blockConditions.conditions.length; i < il; i++)
        {
            // If encountered blockcondition, run recursive function.
            // However if encountered noncritical_condition where the root blockcondition already failed the check, skip.
            const condition = blockConditions.conditions[i];
            const type = condition.type;

            if (type === 'blockconditions')
                checkBlockConditions(possiblePositions, directionVector, condition, playerPosition);

            // Avoids evaulating additional conditions if the check already failed
            else if (failedCheck && type === 'nc_condition')
                continue;

            else
            {
                const blockWorldCoordinate = Vec3(condition.coordinates).rproduct(directionVector).add(playerPosition);
                const blockWorldData = bot.pathfinder.getBlock(blockWorldCoordinate);
                if (blockWorldData)
                {
                    if (
                        (condition.condition === 'empty' && blockWorldData.boundingBox !== 'empty') ||
                        (condition.condition === 'solid' && blockWorldData.boundingBox !== 'block')
                    )
                    {
                        failedCheck = true; // If the block did not meet the conditions, the check is failed
                        if (type === 'condition') break; // However if a condition failed then we can break the loop since no more blocks will meet their conditions.
                    }
                }
                else failedCheck = true;
            }
        }

        if (!failedCheck)
            possiblePositions.push(Vec3(blockConditions.coordinates).rproduct(directionVector).add(playerPosition));
    }
};

const cardinalDirectionVectors3D = [
    Vec3(1, 0, -1), // north
    Vec3(1, 0, 1), // east
    Vec3(-1, 0, 1), // south
    Vec3(-1, 0, -1), // west
];

function euclideanMod(numerator, denominator)
{
    const result = numerator % denominator;
    return result < 0 ? result + denominator : result;
}

Vec3.Vec3.prototype.rproduct = function(vector)
{
    // Rotates direction of relative coordinates given in blockConditions
    // In some cases the x and z coordinate must be switched, hence the if else statement.
    if ( vector.x * vector.z === -1)
    {
        const _x = this.x;
        this.x = this.z*vector.x;
        this.z = _x*vector.z;
    }
    else
    {
        this.x *= vector.x;
        this.z *= vector.z;
    } return this;
};
