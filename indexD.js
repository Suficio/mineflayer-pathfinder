EventEmitter = require('events').EventEmitter
const Vec3 = require('vec3');
const Assert = require('assert');
const Heap = require('fastpriorityqueue');

module.exports = function(bot) {

    bot.navigate = new EventEmitter();
    bot.navigate.Main = M;

    bot.navigate.successorConditions = require("./successorConditions.json");
    bot.navigate.predecessorConditions = require("./predecessorConditions.json");
    bot.navigate.endPosition = null;
    bot.navigate.startPosition = null;
    
    bot.navigate.S = [];
    bot.navigate.P = []; // Delete soon
    bot.navigate.U = new Heap(function(s1,s2) {
        // Compared according to lexicographic ordering
        if ((s1.k[0]<s2.k[0]) || (s1.k[0] === s2.k[0] && s1.k[1] < s2.k[1])) {
            return -1;
        } if (s1.k[1] === s2.k[1]) {
            return 0;
        } return 1;
    });
    bot.navigate.km = null;

    bot.navigate.getPredecessors = function(u) {
        Assert(bot.navigate.successorConditions,"Navigate: Specify bot.navigate.successorConditions before using Navigate");
        return gMS(u,bot.navigate.predecessorConditions);
    };
    bot.navigate.getSuccessors = function(u) {
        Assert(bot.navigate.predecessorConditions,"Navigate: Specify bot.navigate.predecessorConditions before using Navigate");
        return gMS(u,bot.navigate.successorConditions);
    };
    bot.navigate.MAXSTEPS = 8000;
    bot.navigate.HEURISTIC = function (s1,s2) {
        return s1.p.distanceTo(s2.p);
    };
    bot.navigate.COST = function (s1,s2) {
        return s1.p.distanceTo(s2.p);
    }

    function st(coordinates) {
        this.p = coordinates;
        this.g = Number.POSITIVE_INFINITY;
        this.rhs = Number.POSITIVE_INFINITY;
        this.k = null;
        this.u = false;

        var x = coordinates.x >>> 0;
        var y = coordinates.y >>> 0;

        if(!bot.navigate.S[x]) {
            bot.navigate.S[x] = [];
        } if(!bot.navigate.S[x][y]) {
            bot.navigate.S[x][y] = [];
        }

        bot.navigate.S[x][y][coordinates.z >>> 0] = this;
    }

    function cS(n) {
        var x = n.x >>> 0;
        if(bot.navigate.S[x]) {
            var y = n.y >>> 0;
            if(bot.navigate.S[x][y]) {
                if(bot.navigate.S[x][y][n.z >>> 0]) {
                    return true;
                }
            }
        } return false;
    }

    function cmp(s1,s2) {
        // Compared lexicographically
        if ((s1[0]<s2[0]) || (s1[0] === s2[0] && s1[1] < s2[1])) {
            return true;
        }
        return false;
    }

    function CK(s) {
        return [Math.min(s.rhs,s.g) + bot.navigate.HEURISTIC(bot.navigate.startPosition,s) + bot.navigate.km, Math.min(s.g,s.rhs)];
    }

    function UV(u) {
        if (u.u === true) {
            for (i = 0; i < bot.navigate.U.size(); i++) {
                if (bot.navigate.U.nodes[i].p.equals(u.p)) {
                    bot.navigate.U.nodes.splice(i,1);
                }
            }
        } if (u.g !== u.rhs) {
            u.k = CK(u);
            u.u = true;
            bot.navigate.U.push(u);
        }
    }
    
    function CSP() {
        // ComputeShortestPath() as per S. Koenig, 2002
        // Modified to make use of child_process in gMS to leverage threaded processors
        console.time("ComputeShortestPath");

        /*var cps = [];
        //require("os").cpus().length
        console.log(__dirname);
        for( var n = 0; n < 1; n++) {
            cps[n] = cp.fork(__dirname + '/CSPchild.js',[bot]);
        }

        console.log(require("os").cpus().length);*/

        for( var i = 0; i < bot.navigate.MAXSTEPS && (
            cmp(bot.navigate.U.peek().k,CK(bot.navigate.startPosition)) ||
            bot.navigate.startPosition.rhs > bot.navigate.startPosition.g); i++) 
        {
    
            var u = bot.navigate.U.peek();
            u.u = false;
            var k_old = u.k;
            var k_new = CK(u);
    
            if (cmp(k_old,k_new)) {
                console.log("First Condition");
                u.k = k_new;
                u.u = true;
                bot.navigate.U.replace(u);
    
            } else if (u.g > u.rhs) {
                u.g = u.rhs;
                bot.navigate.U.pop();
    
                var predecessors = gMS(u.p,bot.navigate.predecessorConditions);

                for(var n = 0; n < predecessors.length; n++) {
                    var s = predecessors[n];
                    if(!cS(s)) s = new st(s); else s = bot.navigate.S[s.x >>> 0][s.y >>> 0][s.z >>> 0];
                    s.rhs = Math.min(s.rhs, u.g + bot.navigate.COST(u,s));
                    UV(s);
                }
            } else {
                console.log("Third Condition");
                var g_old = u.g;
                u.g = Number.POSITIVE_INFINITY;
    
                var predecessors = gMS(u.p,bot.navigate.successorConditions).push(u);
                /*for (var n = 0; n < predecessors.length; n++) {
                    var s = predecessors[n];
                    if (!s.equals(u.p)) {
                        s.rhs = Math.min(s.rhs,u.g + bot.navigate.COST(u,s));
                    }
                    UV(s);
                }*/
            }
        }
        
        
        console.timeEnd("ComputeShortestPath");
    }
    
    
    function cBC(m,blockConditions,playerPosition) {
        var failedCheck = false;
      
        for (var i = 0, il = blockConditions.conditions.length; i < il; i++) {
            var condition = blockConditions.conditions[i]
            var type = condition.type;
            
            // If encountered blockcondition, run recursive function.
            // However if encountered noncritical_condition where the root blockcondition already failed the check, skip.
    
            if(type === "blockconditions") {
                cBC.call(this,m,blockConditions.conditions[i],playerPosition);
                continue;
            } else if(type === "nc_condition" && failedCheck) continue;
    
            var blockWorldCoordinate = Vec3(condition.coordinates).rproduct(m).add(playerPosition);
            var blockWorldData = bot.blockAt(blockWorldCoordinate);
      
            var bool = (condition.condition === "solid" && blockWorldData.boundingBox !== 'block')||(condition.condition === "empty" && blockWorldData.boundingBox !== 'empty');
            if (bool) {
                failedCheck = true;                 // If the block did not meet the conditions, the check is failed
                if(type === "condition") break;     // However if a condition failed then we can break the loop since no more blocks will meet their conditions.
            }
        }
    
        if(!failedCheck) {
            // If the block met all its conditions, it is pushed to the array with the corresponding world coordinates
            this.push(Vec3(blockConditions.coordinates).rproduct(m).add(playerPosition));
        }
    }
    
    function gMS(u,blockConditions) {
        var possiblePositions = [];
        for(var m = 0; m < 4; m++) {
            for(var i=0, il = blockConditions.length; i < il; i++) {
                cBC.call(possiblePositions,m,blockConditions[i],u);
            }
        } return possiblePositions;
    }

    function M(startCoordinates,endCoordinates) {
        Assert(startCoordinates,"Navigate: Must specify startCoordinates for Initialize");
        Assert(endCoordinates,"Navigate: Must specify endCoordinates for Initialize");
        Assert(bot.navigate.successorConditions,"Navigate: Specify bot.navigate.successorConditions before using Navigate")
        Assert(bot.navigate.predecessorConditions,"Navigate: Specify bot.navigate.predecessorConditions before using Navigate")
        console.time("Main");

        var startPosition = new st(startCoordinates);
        var endPosition = new st(endCoordinates);

        bot.navigate.startPosition = startPosition;
        bot.navigate.endPosition = endPosition;

        bot.navigate.P = [];

        bot.navigate.km = 0;
        endPosition.rhs = 0;
        endPosition.k = [bot.navigate.HEURISTIC(startPosition,endPosition),0];

        bot.navigate.U.push(endPosition);

        //var last = new st(startCoordinates);
        var start = bot.navigate.startPosition;
        var end = bot.navigate.endPosition;
        CSP();
        console.time("Main without CSP");

        if(!start.p.equals(end.p)) {
            if(start.rhs === Number.POSITIVE_INFINITY) {return};

            start = function() {

                var min = Number.POSITIVE_INFINITY;
                var successors = gMS(start.p,bot.navigate.successorConditions);

                for(var n = 0; n < successors.length; n++) {
                    var s = successors[n];
                    if(cS(s)) s = bot.navigate.S[s.x >>> 0][s.y >>> 0][s.z >>> 0]; else continue;
                    
                    var v = bot.navigate.COST(start,s) + s.g;
                    if(v < min) {
                        min = v;
                        d = s;
                    }
                } return d

            }();

            bot.move.to(start.p,function(){console.log("success")});
            bot.navigate.P.push({p:start.p,t:bot.blockAt(start.p).name,m:bot.blockAt(start.p).metadata});
        }

        bot.navigate.endPosition = null;
        bot.navigate.startPosition = null;
        bot.navigate.U.nodes = [];
        bot.navigate.S = [];
        bot.navigate.km = null;

        console.timeEnd("Main");
        console.timeEnd("Main without CSP");
    }
}

Vec3.Vec3.prototype.rproduct = function(direction) {
    
    // Rotates direction of relative coordinates given in blockConditions
    // In some cases the x and z coordinate must be switched, hence the if else statement.
    
    var vector = [Vec3(1,1,1), Vec3(-1,1,1), Vec3(-1,1,-1), Vec3(1,1,-1)][direction];
    if( vector.x * vector.z === -1) {
        return new Vec3(this.z*vector.x,this.y*vector.y,this.x*vector.z);
    } else {
        return new Vec3(this.x*vector.x,this.y*vector.y,this.z*vector.z);
    }
    
};