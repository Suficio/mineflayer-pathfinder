EventEmitter = require('events').EventEmitter
const Vec3 = require('vec3');

const optVer = require("minecraft-protocol/src/version").defaultVersion
const blockData = require('minecraft-data')(optVer).blocks;

module.exports = function(bot)
{
    // The greatest speedup that can be achieved at this point would be by optimizing the cBC function. It was purposefully built to be dynamic however
    // a hardcoded implementation could work so much much faster. That being said the successorconditions.json is not optimized either, one could implement a top
    // to bottom search considering the fact that once a block at the top is found, none of the blocks at the bottom will be accessible.

    bot.navigate = new EventEmitter();
    bot.navigate.ENUMPathfinder = {ASTAR:0,DLITE:1};
    bot.navigate.ENUMStatus = {Complete:0,Incomplete:1};

    bot.navigate.getSuccessors = gMS.bind(undefined,require("./successorConditions.json"));
    bot.navigate.getPredecessors = gMS.bind(undefined,require("./successorConditions.json"));

    // Native getBlock implementation too slow for this case
    bot.navigate.getBlock = function(absolutePoint)
    {
        const key = Vec3(euclideanMod(absolutePoint.x,16),absolutePoint.y,euclideanMod(absolutePoint.z,16));
        const column = bot._chunkColumn(absolutePoint.x - key.x, absolutePoint.z - key.z);
        
        if (!column) return null; else return blockData[column.getBlockType(key)];
    }

    // Main function to interact
    bot.navigate.to = function(Start,End,ENUMPathfinder)
    {
        if(!ENUMPathfinder || ENUMPathfinder === bot.navigate.ENUMPathfinder.ASTAR) {

            return require("./Pathfinders/ASTAR.js")(bot,Start,End);
        } else if(ENUMPathfinder === bot.navigate.ENUMPathfinder.DLITE) {

            return require("./Pathfinders/DLITE.js")(bot,Start,End);
        }
    }

    bot.navigate.PATH = [];
    bot.navigate.SCAFFOLD = false;
    bot.navigate.MAX_EXPANSIONS = 100000; // 100000
    bot.navigate.HEURISTIC = function (s1,s2) {
        return s1.p.distanceTo(s2.p);
    };
    bot.navigate.COST = function (s1,s2) {
        return s1.p.distanceTo(s2.p);
    };

    // Block condition functions
    function gMS(blockConditions,u)
    {
        const possiblePositions = [];
        for(var m = 0; m < 4; m++) {
            for(var i = 0, il = blockConditions.length; i < il; i++) {

                const pos = cBC(cardinalDirectionVectors3D[m],blockConditions[i],u);
                if(pos) {possiblePositions.push(pos); break}
            }
        }
        
        return possiblePositions;
    }

    function cBC(m,blockConditions,playerPosition)
    {
        var failedCheck = false;
    
        for (var i = 0, il = blockConditions.conditions.length; i <= il; i++) {
            // If encountered blockcondition, run recursive function.
            // However if encountered noncritical_condition where the root blockcondition already failed the check, skip.
            const condition = blockConditions.conditions[i];

            if(condition) {

                const type = condition.type;

                if(type === "blockconditions") {
                    // Terminates early if a possible position is already found.
                    if(!failedCheck) return Vec3(blockConditions.coordinates).rproduct(m).add(playerPosition);
                    return cBC(m,condition,playerPosition);
                } else if(type === "nc_condition" && failedCheck) {
                    // Avoids evaulating additional conditions if the check already failed
                    continue;
                } else {

                    const blockWorldCoordinate = Vec3(condition.coordinates).rproduct(m).add(playerPosition);
                    const blockWorldData = bot.navigate.getBlock(blockWorldCoordinate);
                    if (
                        blockWorldData &&
                        ((condition.condition === "solid" && 
                        blockWorldData.boundingBox !== 'block') ||
                        (condition.condition === "empty" && 
                        blockWorldData.boundingBox !== 'empty'))
                    ) {
                        if(type === "condition") break;     // If the block did not meet the conditions, the check is failed
                        failedCheck = true;                 // However if a condition failed then we can break the loop since no more blocks will meet their conditions.
                    }
                }
            } else {
                if(!failedCheck) return Vec3(blockConditions.coordinates).rproduct(m).add(playerPosition);
                return undefined;
            }
        }
    }

};

// Custom GetBlock implementation

const cardinalDirectionVectors3D = [
    Vec3(1,0,-1), // north
    Vec3(1,0,1), // east
    Vec3(-1,0,1), // south
    Vec3(-1,0,-1) // west
];

function euclideanMod(numerator, denominator)
{
    var result = numerator % denominator;
    return result < 0 ? result + denominator : result;
}

Vec3.Vec3.prototype.rproduct = function(vector)
{
    // Rotates direction of relative coordinates given in blockConditions
    // In some cases the x and z coordinate must be switched, hence the if else statement.
    if( vector.x * vector.z === -1) {
        const _x = this.x;
        this.x = this.z*vector.x;
        this.z = _x*vector.z;
    } else {
        this.x *= vector.x;
        this.z *= vector.z;
    } return this;
};