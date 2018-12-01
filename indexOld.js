EventEmitter = require('events').EventEmitter
const Vec3 = require('vec3');
const Vec2 = require('vec2');
const Assert = require('assert');
const Heap = require('fastpriorityqueue');

const optVer = require("minecraft-protocol/src/version").defaultVersion
const blockData = require('minecraft-data')(optVer).blocks;

const cardinalDirectionVectors2D = [
    Vec2(-1,0), // north
    Vec2(0,-1), // east
    Vec2(1,0), // south
    Vec2(0,1) // west
];

const cardinalDirectionVectors3D = [
    Vec3(1,0,-1), // north
    Vec3(1,0,1), // east
    Vec3(-1,0,1), // south
    Vec3(-1,0,-1) // west
];

function st(input) {
    if (input instanceof Array) {
        this.p = input[0];
        this.d = input[1];
        this.b = input[2];
    } else {
        this.p = input;
        this.d = null;
        this.b = null;
    }

    this.g = Number.POSITIVE_INFINITY;
    this.f = Number.POSITIVE_INFINITY;
    this.cF = null;
};

module.exports = function(bot) {

    bot.navigate = new EventEmitter();
    bot.navigate.successorConditions = require("./successorConditions.json");
    bot.navigate.to = As;
    bot.navigate.getSuccessors = function(u) {return gMS(u,bot.navigate.successorConditions)};

    // Closed list functions
    bot.navigate.C = [];
    bot.navigate.C.push = function(s) {

        var x = s.p.x >>> 0;
        var y = s.p.y >>> 0;

        if(!this[x]) {
            this[x] = [];
        } if(!this[x][y]) {
            this[x][y] = [];
        }

        this[x][y][s.p.z >>> 0] = s;
    };
    bot.navigate.C.check = function(p) {

        var x = p.x >>> 0;
        if(this[x]) {
            var y = p.y >>> 0;
            if(this[x][y]) {
                if(this[x][y][p.z >>> 0]) {
                    return true;
                }
            }
        } return false;
    };

    // Open list functions
    bot.navigate.O = new Heap(function(s1,s2) {
        return s1.f < s2.f;
    });
    bot.navigate.O.check = function(s) {
        for(var i = 0; i < this.size; i++) {
            if(this.array[i].p.equals(s.p)) return i;
        } return undefined;
    };
    bot.navigate.O.replace = function(i,s) {
        this.array[i] = s;
        this._percolateUp(i);              
    };

    // Maintain familiarity with original heap implementation
    bot.navigate.O.push = bot.navigate.O.add;
    bot.navigate.O.pop = bot.navigate.O.poll;

    function euclideanMod(numerator, denominator) {
        var result = numerator % denominator;
        return result < 0 ? result + denominator : result;
    }

    // The usual bot.getBlock implementation proved wayyyyy too fucking slow for JPS to be viable
    bot.navigate.getBlock = function(absolutePoint) {

        const key = Vec3(euclideanMod(absolutePoint.x,16),absolutePoint.y,euclideanMod(absolutePoint.z,16));
        const column = bot._chunkColumn(absolutePoint.x - key.x, absolutePoint.z - key.z);
        
        if (!column) return null; else return blockData[column.getBlockType(key)];
    }

    bot.navigate.PATH = [];
    bot.navigate.SCAFFOLD = false;
    bot.navigate.MAX_EXPANSIONS = 800000; // 100000
    bot.navigate.HEURISTIC = function (s1,s2) {
        return s1.p.distanceTo(s2.p);
    };
    bot.navigate.COST = function (s1,s2) {
        return s1.p.distanceTo(s2.p);
    };

    function CP(s) {

        var path = [s.p];
        while(s.cF) {
            s = s.cF;
            path.push(s.p);
        }

        bot.navigate.PATH = path;
        bot.navigate.emit("pathFound",path);

        while(!bot.navigate.O.isEmpty()) {
            bot.navigate.O.pop();
        }; bot.navigate.C.length = 0;

    };

    function As(sp,ep) {
        // A* as per Peter E. Hart, Nils J. Nilsson, Bertram Raphael, 1968
        // Roughly as described in https://en.wikipedia.org/wiki/A*_search_algorithm#Pseudocode

        // I was not able to get JPS working faster than the original A* algorithim despite greately increasing the speed of getBlock. It may be a futile effort
        // unless anyone has any ideas as to how to optimize it.

        // The current 2D implementation does indeed greately outperform the 3D A*, consideration should be put into crossing y-levels only at diagonals however this
        // may result in unoptimal paths and many more edge cases to be programmed.

        // Converting the closed list to a one dimensional array should be considered, I did not manage to get an integer hashtable to work faster than the
        // current implementation, this could have been due to an expenisve computation of the hash, however easier to compute hashes collided too frequently.
        // Additionally nested arrays allow the AI to traverse the entirety of the world instead of being limited by integer limits.

        // The greatest speedup that can be achieved at this point would be by optimizing the gMS function. It was purposefully built to be dynamic however
        // a hardcoded implementation could work so much much faster. That being said the successorconditions.json is not optimized either, one could implement a top
        // to bottom search considering the fact that once a block at the top is found, none of the blocks at the bottom will be accessible.

        // Maintains the element with the best path
        var closest = new st(sp.floored());
        closest.g = 0; // Otherwise POSITIVE_INFINITY - POSITIVE_INFINITY returns NaN

        bot.navigate._start = new st(sp.floored());
        bot.navigate._end = new st(ep.floored());

        bot.navigate._start.g = 0;
        bot.navigate._start.f = bot.navigate.HEURISTIC(bot.navigate._start,bot.navigate._end);
        bot.navigate.O.push(bot.navigate._start);

        setTimeout(function() {
            for(var i = 0; i < bot.navigate.MAX_EXPANSIONS && bot.navigate.O.size !== 0; i++) {

                const current = bot.navigate.O.pop();
                if(current.p.equals(bot.navigate._end.p)) return CP(current);
                bot.navigate.C.push(current);

                const successors = gMS(current.p,bot.navigate.successorConditions);
                // successors = JPSN(current);
                for(var n = 0, len = successors.length; n < len; n++) {

                    if(bot.navigate.C.check(successors[n])) continue;
                    const s = new st(successors[n]);

                    const tg = current.g + bot.navigate.COST(current,s);
                    if(tg >= s.g) continue;
    
                    s.cF = current;
                    s.g = tg;
                    s.f = s.g + bot.navigate.HEURISTIC(s,bot.navigate._end);
    
                    const i = bot.navigate.O.check(s);
                    if(!i) bot.navigate.O.push(s); else bot.navigate.O.replace(i,s);
                };
    
                // Retains the closest element to the end
                if(current.f - current.g < closest.f - closest.g) closest = current;
            };
            if(bot.navigate.SCAFFOLD) {
                console.log("WARNING: Did not find path in allowed MAX_EXPANSIONS, attempting scaffolding");
            } else {
                console.log("WARNING: Did not find path in allowed MAX_EXPANSIONS, returned closest path");
                return CP(closest);
            }
        },0)
    };

    function JPSN(o) {
        // Jump Point Search as per Daniel Harabor, Alban Grastien, 2011
        // Paper avaliable at http://users.cecs.anu.edu.au/~dharabor/data/papers/harabor-grastien-aaai11.pdf

        // The implementation is not a perfect 3D implementation of JPS, as most of the movement is done along the horizontal plane.
        // This should at least speed up pathing across flat terrain, where computing neighbors and additions to open list are expensive.

        // JPS Nodes must be expanded using traditional A* successors as re-running JPS on them will yield no new nodes if successors are on different y-level.
        // In an effort to improve performance, 2D vector math is used instead to save on operations in vain.

        // I was not able to get this running faster than the optimized A* Algorithm

        // Retains the ylevel of the current iteration.
        bot.navigate._yl = o.p.y;
        const origin = {p:Vec2(o.p.x,o.p.z), d:o.d, b:o.b}

        function strRec(origin,directionVector) {

            const candidatePosition = origin.add(directionVector,true);

            // Checks if it hasnt reached the end
            if(cE(origin)) {
                this.push([Vec3(origin.x,bot.navigate._yl,origin.y),null,null]);
                return;
            }

            if(pM(candidatePosition)) {

                const dir = Vec2(directionVector.y,directionVector.x);
                const rdir = Vec2(-directionVector.y,-directionVector.x);

                const tempArray = [];

                if(!pM(origin.add(dir,true))) {
                    // Check sides for possible successors
                    if(pM(candidatePosition.add(dir,true))) {

                        tempArray.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,dir]);
                    } else {

                        tempArray.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,Vec2(dir.x-directionVector.x,dir.y-directionVector.y)]);
                    }
                } if (!pM(origin.add(rdir,true))) {
                    // Check sides for possible successors
                    if(pM(candidatePosition.add(rdir,true))) {

                        tempArray.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,rdir]);
                    } else {

                        tempArray.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,Vec2(rdir.x-directionVector.x,rdir.y-directionVector.y)]);
                    }
                }

                // If nothing was found then continue the iteration
                if(tempArray.length === 0) {
                    strRec.call(this,candidatePosition,directionVector);
                } else {
                    this.push(tempArray[0]);
                    if(tempArray[1]) this.push(tempArray[1]);
                }
            } else {
                // It could occur that the else statement could fire while there are valid points to move to at dir and rdir,
                // though this is an edge case and wouldnt matter in the long run.
                this.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,Vec2(0,0)]);
            }
        }

        function diagRec(origin,directionVector) {

            const candidatePosition = origin.add(directionVector,true);
            const dirX = Vec2(directionVector.x,0);
            const dirY = Vec2(0,directionVector.y);
            const dir = directionVector.multiply(-1,true);

            const tempArray = [];

            function _strRec(origin,directionVector) {
                // Checks if it hasnt reached the end
                if(cE(origin)) return true;
    
                const candidatePosition = origin.add(directionVector,true);
                if(pM(candidatePosition)) {

                    const dir = Vec2(directionVector.y,directionVector.x);
                    const rdir = Vec2(-directionVector.y,-directionVector.x);
                    if(
                        (!pM(origin.add(dir,true)) && pM(candidatePosition.add(dir,true))) || 
                        (!pM(origin.add(rdir,true)) && pM(candidatePosition.add(rdir,true)))
                    ) {
                        return true;
                    } else {
                        return _strRec(candidatePosition,directionVector);
                    }
                } else {
                    // Recursion encountered end
                    return true;
                }
            }

            // Checks pruning rules for Diagonal Recursion
            // Maintains direction of the change as a bias
            if(
                !pM(origin.add(Vec2(dir.x,0),true)) && 
                pM(origin.add(Vec2(dir.x,directionVector.y),true))
            ) {
                tempArray.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,Vec2(2*dir.x,0)]);
            } if (
                !pM(origin.add(Vec3(0,dir.y),true)) && 
                pM(origin.add(Vec2(directionVector.x,dir.y),true))
            ) {
                tempArray.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,Vec2(0,2*dir.y)]);
            }
            // If both evaluate to true then the block should not be accessible
            if(tempArray.length === 2) return; else if(tempArray.length === 1) {this.push(tempArray[0]); return}

            // Checks if it hasnt reached the end
            if(cE(origin)) {
                this.push([Vec3(origin.x,bot.navigate._yl,origin.y),null,null]);
                return;
            }

            // Checks Vertical and Horizontal Recursions
            if(
                pM(origin.add(dirX,true)) && _strRec(origin.add(dirX,true),dirX) ||
                pM(origin.add(dirY,true)) && _strRec(origin.add(dirY,true),dirY)
            ) {
                this.push([Vec3(origin.x,bot.navigate._yl,origin.y),directionVector,Vec2(0,0)]);
                return;
            }

            if(pM(candidatePosition)) diagRec.call(this,candidatePosition,directionVector);
        }

        var openPositions = [];
        if(origin.d === null) {
            for( var i = 0, len = cardinalDirectionVectors2D.length; i < len; i++) {

                const dirVector = cardinalDirectionVectors2D[i];
                const diagVector = cardinalDirectionVectors2D[i].add(cardinalDirectionVectors2D[(i === 3) ? 0 : i + 1],true);
                const strPos = origin.p.add(dirVector,true);
                const diagPos = origin.p.add(diagVector,true);

                if(pM(strPos)) {
                    strRec.call(openPositions,strPos,dirVector);
                } if(pM(diagPos)) {
                    diagRec.call(openPositions,diagPos,diagVector);
                }
            }
            // If the prior loop did not return any valid successors then attempt to use getNeighbors.
            if(openPositions.length === 0) {
                for( var i = 0, len = cardinalDirectionVectors2D.length; i < len; i++) {

                    const dirVector = cardinalDirectionVectors2D[i];
                    const successors = getNeighbors(Vec3(origin.p.x,bot.navigate._yl,origin.p.y),Vec3(dirVector.x,0,dirVector.y));
                    if(successors.length !== 0) openPositions.push([successors[0],null]);
                }
            }
        } else {
            // Checks if the node came from a straight
            if(origin.d.x * origin.d.y === 0) {

                const diagVector = origin.d.add(origin.b,true);
                const strPos = origin.p.add(origin.d,true);
                const diagPos = origin.p.add(diagVector,true);

                const neighDir = origin.b.equal(0,0) ? origin.d : origin.b;
                const successors = getNeighbors(Vec3(origin.p.x,bot.navigate._yl,origin.p.y),Vec3(neighDir.x,0,neighDir.y));

                if(pM(strPos)) {
                    strRec.call(openPositions,strPos,origin.d);
                }
                // Checks whether the diagVector is diagonal or straight
                if(diagVector.x * diagVector.y === 0) {

                    const successors = getNeighbors(Vec3(origin.p.x,bot.navigate._yl,origin.p.y),Vec3(diagVector.x,0,diagVector.y));
                    if(successors.length !== 0) openPositions.push([successors[0],null]);

                } else if(pM(diagPos)) {
                    diagRec.call(openPositions,diagPos,diagVector);
                }

                // We only consider traversing y-levels if it came from a straight for simplicity
                if(successors.length !== 0) openPositions.push([successors[0],null]);

            } else {

                const dirX = Vec2(origin.d.x,0);
                const dirY = Vec2(0,origin.d.y);
                const dirXPos = origin.p.add(dirX,true);
                const dirYPos = origin.p.add(dirY,true);
                const diagPos = origin.p.add(origin.d,true);

                if(pM(dirXPos)) {
                    strRec.call(openPositions,dirXPos,dirX);
                } if(pM(dirYPos)) {
                    strRec.call(openPositions,dirYPos,dirY);
                }

                if(pM(diagPos)) {
                    diagRec.call(openPositions,diagPos,origin.d);
                }

                if(!origin.b.equal(0,0)) {

                    const dir = origin.d.add(origin.b,true);
                    const dirPos = origin.p.add(dir,true);
                    if(pM(dirPos)) {
                        diagRec.call(openPositions,dirPos,dir);
                    }
                }
            }
        }
        return openPositions
    }

    function cE(p) {
        // Macro function for quick checking of whether the current node is the end node
        if(p.equal(bot.navigate._end.p.x, bot.navigate._end.p.z) && bot.navigate._end.p.y === bot.navigate._yl) return true;
        else return false;
    }

    function pM(p) {
        // Macro function for quick checking of traversable nodes in JPSN
        p = Vec3(p.x,bot.navigate._yl,p.y);
        return (
            !(bot.navigate.getBlock(p.offset(0,-1,0)).boundingBox !== 'block') &&
            !(bot.navigate.getBlock(p).boundingBox !== 'empty') &&
            !(bot.navigate.getBlock(p.offset(0,1,0)).boundingBox !== 'empty')
        ) ? true : false;
    }

    function cBC(m,blockConditions,playerPosition) {
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
    
    function gMS(u,opt,blockConditions) {

        const possiblePositions = [];

        if(!blockConditions) {
            blockConditions = opt;
            for(var m = 0; m < 4; m++) {
                for(var i = 0, il = blockConditions.length; i < il; i++) {
    
                    const pos = cBC(cardinalDirectionVectors3D[m],blockConditions[i],u);
                    if(pos) {possiblePositions.push(pos); break}
                }
            }
        } else {
            for(var i = 0, il = blockConditions.length; i < il; i++) {
    
                const pos = cBC(opt,blockConditions[i],u);
                if(pos) {possiblePositions.push(pos); break}
            }
        } return possiblePositions;
    }
};

Vec3.Vec3.prototype.rproduct = function(vector) {
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