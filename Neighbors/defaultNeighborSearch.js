'use strict';

const Vec3 = require('vec3');

module.exports = function(bot)
{
    const successorConditions = require('./../DefaultConditions/successorConditions.json');
    const predecessorConditions = require('./../DefaultConditions/predecessorConditions.json');

    bot.pathfinder.getSuccessors = getCardinalNeighbors.bind(undefined, successorConditions);
    bot.pathfinder.getPredecessors = getCardinalNeighbors.bind(undefined, predecessorConditions);

    function getCardinalNeighbors(blockConditions, u)
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
                const blockWorldCoordinate = new Vec3(condition.coordinates).rproduct(directionVector).add(playerPosition);
                const blockWorldData = bot.pathfinder.getBlock(blockWorldCoordinate);
                if (!blockWorldData || blockWorldData.boundingBox !== condition.condition)
                {
                    failedCheck = true; // If the block did not meet the conditions, the check is failed
                    if (type === 'condition') break; // However if a condition failed then we can break the loop since no more blocks will meet their conditions.
                }
            }
        }

        if (!failedCheck)
            possiblePositions.push(new Vec3(blockConditions.coordinates).rproduct(directionVector).add(playerPosition));
    }
};

const cardinalDirectionVectors3D = [
    new Vec3(1, 0, -1), // north
    new Vec3(1, 0, 1), // east
    new Vec3(-1, 0, 1), // south
    new Vec3(-1, 0, -1), // west
];

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
