'use strict';
const Heap = require('fastpriorityqueue');
const Vec3 = require('vec3');

module.exports = function DLITEReturnState(bot, sp, ep)
{
    // Global state functions
    const S = [];
    S.push = function(s)
    {
        const x = s.p.x >>> 0;
        const y = s.p.y >>> 0;

        if (!this[x])
            this[x] = [];
        if (!this[x][y])
            this[x][y] = [];

        this[x][y][s.p.z >>> 0] = s;
    };
    S.check = function(p)
    {
        const x = p.x >>> 0;
        if (this[x])
        {
            const y = p.y >>> 0;
            if (this[x][y])
            {
                if (this[x][y][p.z >>> 0])

                    return true;
            }
        } return false;
    };

    // Priority queue functions
    const U = new Heap(function(s1, s2) {return CompareKeys(s1.k, s2.k);});
    U.check = function(s)
    {
        for (let i = 0; i < this.size; i++)
            if (this.array[i] === s) return i;
        return undefined;
    };
    U.insert = function(s, k)
    {
        s.k = k;
        this.add(s);
    };
    U.update = function(i, k)
    {
        // Priority queue handles the percolation automatically eitherway
        this.array[i].k = k;
    };

    // Maintain familiarity with original heap implementation
    U.remove = U._removeAt;
    U.pop = U.poll;

    Object.defineProperty(this, 'U', {value: U, enumerable: false});
    Object.defineProperty(this, 'S', {value: S, enumerable: false});

    Object.defineProperty(this, 'State', {value: State, enumerable: false});
    function State(p)
    {
        if (S.check(p))
            return S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
        else
        {
            this.p = p;
            this.g = Number.POSITIVE_INFINITY;
            this.rhs = Number.POSITIVE_INFINITY;

            this.k = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

            S.push(this);
        }
    };

    // Path functions
    const R = this;
    this.path = {};

    Object.defineProperty(this.path, '_peek', {value: _peek, enumerable: false});
    function _peek()
    {
        // First part of Main() in D*Lite
        if (R.S.start === R.S.goal) return undefined;

        let minState;
        let minCost = Number.POSITIVE_INFINITY;

        // Get successors according to stored state.
        const successors = bot.pathfinder.getSuccessors(R.S.start.p);
        for (let n = 0, len = successors.length; n < len; n++)
        {
            const sp = ExistingState(successors[n]);
            if (sp)
            {
                const cost = bot.pathfinder.COST(R.S.start.p, sp.p) + sp.g;
                if (minCost > cost)
                {
                    minCost = cost;
                    minState = sp;
                }
            }
        }

        return minState;
    }
    this.path.peek = function()
    {
        const temp = this._peek();
        if (temp !== undefined)
            return temp.p;
        else return undefined;
    };
    this.path.pop = function()
    {
        const temp = this._peek();
        if (temp !== undefined)
        {
            R.S.start = temp;
            return temp.p;
        }
        else return undefined;
    };

    this.Initialize = function()
    {
        this.k_m = 0;

        this.S.start = new this.State(sp);
        this.S.goal = new this.State(ep);
        this.S.goal.rhs = 0;

        this.S.last = this.S.start;

        this.U.insert(this.S.goal, [bot.pathfinder.HEURISTIC(this.S.start.p, this.S.goal.p), 0]);

        const MainPromise = R.ComputeShortestPath();
        this.on = function(Callback)
        {
            MainPromise.then(function(IntermediateObject)
            {
                R.ENUMStatus = IntermediateObject.ENUMStatus;
                if (IntermediateObject.ENUMStatus === bot.pathfinder.ENUMStatus.Incomplete)
                {
                    console.warn(
                        'WARNING Pathfinder: Did not find path in allowed MAX_EXPANSIONS,',
                        'returned path to closest valid end point'
                    );
                }

                Callback(R);
            }).catch(function(e) {console.error('ERROR Pathfinder:', e);});
        };
    };

    // Handles changes in the world state
    bot.on('blockUpdate', function(_, newBlock)
    {
        const v = ExistingState(newBlock.position);
        console.log(v);
        console.log(R.S.start);
        if (v && CompareKeys(v.k, R.S.start.k)) // Ensures we havent already passed that block
        {
            const OBSOLETEPromise = new Promise(function(resolve)
            {
                R.k_m = R.k_m + bot.pathfinder.HEURISTIC(R.S.last.p, R.S.start.p);
                R.S.last = R.S.start;
                // Since the event is only validated when a previously navigable vertex is blocked
                // we need to only accomodate for one case. [c_old < c(u,v)]
                const predecessors = bot.pathfinder.getPredecessors(v.p);
                for (let n = 0, len = predecessors.length; n < len; n++)
                {
                    const u = ExistingState(predecessors[n]);
                    const c_old = bot.pathfinder.COST(u.p, v.p);
                    if (u)
                    {
                        if (floatEqual(u.rhs, c_old + v.g) && u !== R.S.goal)
                        {
                            u.rhs = Number.POSITIVE_INFINITY;

                            const successors = bot.pathfinder.getSuccessors(u.p);
                            for (let m = 0, len = successors.length; m < len; m++)
                            {
                                const sp = new R.State(successors[m]);
                                const cost = bot.pathfinder.COST(u.p, sp.p) + sp.g;
                                if (u.rhs > cost) u.rhs = cost;
                            }
                        }
                    }

                    R.UpdateVertex(u);
                }

                R.ComputeShortestPath().then(function(IntermediateObject)
                {
                    R.ENUMStatus = IntermediateObject.ENUMStatus;
                    if (IntermediateObject.ENUMStatus === bot.pathfinder.ENUMStatus.Incomplete)
                    {
                        console.warn(
                            'WARNING Pathfinder: Did not find path in allowed MAX_EXPANSIONS,',
                            'returned path to closest valid end point'
                        );
                    }

                    R.S.OBSOLETE = undefined;
                    resolve(R);
                });
            });

            R.S.OBSOLETE = OBSOLETEPromise;
        }
    });

    function ExistingState(p)
    {
        if (R.S.check(p))
            return R.S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
        else return undefined;
    }
};

function CompareKeys(k1, k2)
{
    return (floatEqual(k1[0], k2[0]) && k1[1] < k2[1]) || k1[0] < k2[0];
}

function floatEqual(f1, f2)
{
    if (f1 === Number.POSITIVE_INFINITY && f2 === Number.POSITIVE_INFINITY) return true;
    return Math.abs(f1 - f2) < Number.EPSILON;
}
