'use strict';
const Heap = require('fastpriorityqueue');

module.exports = function(bot, sp, ep)
{
    function LPASTARReturnState(MainPromise)
    {
        const returnState = this;

        this.OBSOLETE = [];

        this.on = function(callback)
        {
            MainPromise
                .then(function(IntermediateObject)
                {
                    returnState.ENUMStatus = IntermediateObject.ENUMStatus;
                    if (IntermediateObject.ENUMStatus === bot.pathfinder.ENUMStatus.Incomplete)
                    {
                        console.warn(
                            'WARNING Pathfinder: Did not find path in allowed MAX_EXPANSIONS,',
                            'returned path to closest valid end point'
                        );
                    }
    
                    // Builds path
                    let state = IntermediateObject.state;
                    returnState.path.length = 0;
                    returnState.path.push(state.c);
    
                    while (state.p)
                    {
                        state = state.p;
                        returnState.path.push(state.c);
                    }
    
                    callback(returnState);
                })
                .catch(function(e) {console.error('ERROR Pathfinder:', e);});
        };

        // Path functions
        this.path = [];
        this.path.peek = function() {return this[0];};
        this.path.replan = function()
        {

        };

        // Handles changes in the world state
        bot.on('blockUpdate', function(_, newBlock)
        {

        });
    };

    // Global state functions
    const S = [];
    S.push = function(s)
    {
        const x = s.c.x >>> 0;
        const y = s.c.y >>> 0;

        if (!this[x])
            this[x] = [];
        if (!this[x][y])
            this[x][y] = [];

        this[x][y][s.c.z >>> 0] = s;
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
    const U = new Heap(function(s1, s2) {return compareKeys(s1.k, s2.k);});
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
        const k_old = this.array[i].k;
        this.array[i].k = k;

        if (compareKeys(k_old, k))
            this._percolateDown(i);
        else this._percolateUp(i);
    };

    // Maintain familiarity with original heap implementation
    U.remove = U._removeAt;
    U.pop = U.poll;

    // State functions
    function State(c)
    {
        if (S.check(c))
            return S[c.x >>> 0][c.y >>> 0][c.z >>> 0];
        else
        {
            this.c = c;
            this.g = Number.POSITIVE_INFINITY;
            this.rhs = Number.POSITIVE_INFINITY;

            this.p = null;

            this.k = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

            S.push(this);
        }
    }

    // Algorithm functions
    function calculateKey(s)
    {
        return [
            Math.min(s.g, s.rhs) + bot.pathfinder.HEURISTIC(s.c, S.goal.c),
            Math.min(s.g, s.rhs),
        ];
    }

    function updateVertex(u)
    {
        const exists = U.check(u); // Integer index
        const equals = floatEqual(u.g, u.rhs);

        if (!equals && exists !== undefined) U.update(exists, calculateKey(u));
        else if (!equals && exists === undefined) U.insert(u, calculateKey(u));
        else if (equals && exists !== undefined) U.remove(exists);
    }

    function computeShortestPath()
    {
        const CSPPromise = new Promise(function(resolve)
        {
            let closest = S.start;

            for (let i = 0; i < bot.pathfinder.MAX_EXPANSIONS && U.size !== 0 &&
                (compareKeys(U.peek().k, calculateKey(S.goal)) || S.goal.rhs > S.goal.g); i++)
            {
                const u = U.peek();

                if (u.g > u.rhs)
                {
                    u.g = u.rhs;
                    U.pop(); // U.remove from first

                    const successors = bot.pathfinder.getSuccessors(u.c);
                    for (let n = 0, len = successors.length; n < len; n++)
                    {
                        const s = new State(successors[n]);
                        const cost = u.g + bot.pathfinder.COST(u.c, s.c);

                        if (s.rhs > cost)
                        {
                            s.p = u;
                            s.rhs = cost;
                            updateVertex(s);
                        }
                    }
                }
                else
                {
                    u.g = Number.POSITIVE_INFINITY;

                    const successors = bot.pathfinder.getSuccessors(u.c);
                    successors.push(u.c); // ∪ {u}
                    for (let n = 0, len = successors.length; n < len; n++)
                    {
                        const s = new State(successors[n]);
                        if (s !== S.start && s.p === u)
                        {
                            s.rhs = Number.POSITIVE_INFINITY;

                            const predecessors = bot.pathfinder.getPredecessors(s.c);
                            for (let m = 0, len = predecessors.length; m < len; m++)
                            {
                                const sp = new State(predecessors[m]);
                                const cost = bot.pathfinder.COST(s.c, sp.c) + sp.g;

                                if (s.rhs > cost)
                                {
                                    s.rhs = cost;
                                    s.p = sp;
                                }
                            }
                        }
                        updateVertex(s);
                    }
                }

                // Retains the closest element to the end
                if (u.k[0] - u.k[1] < closest.k[0] - closest.k[1]) closest = u;
            }

            if (S.goal.rhs === Number.POSITIVE_INFINITY)
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Incomplete, state: closest});
            else
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Complete, state: S.goal});
        });

        return CSPPromise;
    }

    // Initialize

    S.goal = new State(ep);
    S.start = new State(sp);
    S.start.rhs = 0;

    U.insert(
        S.start,
        [bot.pathfinder.HEURISTIC(S.start.c, S.goal.c), 0]
    );

    return new LPASTARReturnState(computeShortestPath());
};

function compareKeys(k1, k2)
{
    return (floatEqual(k1[0], k2[0]) && k1[1] < k2[1]) || k1[0] < k2[0];
}

function floatEqual(f1, f2)
{
    if (f1 === Number.POSITIVE_INFINITY && f2 === Number.POSITIVE_INFINITY) return true;
    return Math.abs(f1 - f2) < Number.EPSILON;
}
