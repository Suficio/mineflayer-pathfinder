'use strict';
const Heap = require('fastpriorityqueue');

module.exports = function(bot, sp, ep)
{
    // D* Lite as per S. Koenig, 2002
    // Compute Shortest Path and UpdateVertex as described in http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf
    // Based on an optimized version of D* Lite as presented in Figure 4.

    // The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for
    // convenient changes of costs at runtime, which can be used for entity avoidance.

    function DLITEReturnState()
    {
        const returnState = this;

        // Path functions
        this.path = {};
        function _peek()
        {
            // First part of Main() in D*Lite
            if (S.start === S.goal) return undefined;

            let minState;
            let minCost = Number.POSITIVE_INFINITY;

            // Get successors according to stored state.
            const successors = bot.pathfinder.getSuccessors(S.start.c);
            for (let n = 0, len = successors.length; n < len; n++)
            {
                const sp = new State(successors[n]);
                if (sp)
                {
                    const cost = bot.pathfinder.COST(S.start.c, sp.c) + sp.g;
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
            const temp = _peek();
            if (temp !== undefined)
                return temp.c;
            else return;
        };

        let globalMinCost = Number.POSITIVE_INFINITY;
        this.path.pop = function()
        {
            const temp = _peek();
            if (temp !== undefined)
            {
                const cost = bot.pathfinder.COST(S.start.c, temp.c) + temp.g;
                if (cost >= globalMinCost) return;

                globalMinCost = cost;
                S.start = temp;

                k_m = k_m + bot.pathfinder.HEURISTIC(S.last.c, S.start.c);
                S.last = S.start;

                return temp.c;
            }
            else return;
        };

        this.path.replan = function(c)
        {
            return new Promise(function(resolve, reject)
            {
                computeShortestPath()
                    .then(function(intermediateObject)
                    {
                        returnState.ENUMStatus = intermediateObject.ENUMStatus;
                        if (intermediateObject.ENUMStatus === bot.pathfinder.ENUMStatus.Incomplete)
                        {
                            console.warn(
                                'WARNING Pathfinder: Did not find path in allowed MAX_EXPANSIONS,',
                                'returned path to closest valid end point'
                            );
                        }

                        resolve(returnState);
                    })
                    .catch(function(e)
                    {
                        console.error('ERROR Pathfinder:', e);
                        reject(e);
                    });
            });
        };

        // Changes in world state are passed to this function
        this.path.updateState = function(c)
        {
            // Check if state or any predecessors of the state are part of the pathfinder state
            let existsInState = false;
            const predecessors = bot.pathfinder.getPredecessors(c);

            if (S.check(c))
                existsInState = true;

            else
            {
                for (let m = 0, len = predecessors.length; m < len; m++)
                {
                    if (S.check(predecessors[m]))
                    {
                        existsInState = true;
                        break;
                    }
                }
            }

            if (!existsInState)
                return;

            // Updated block is relevant to pathfinder state
            // Check if state is blocked or can traverse

            // Usually a block above the state might be blocking it, this performs a check for a block right below
            // it as either one or the other will be traversable. c0 is considered the relevant state position.

            let traversable = false;
            let c0 = c;
            const c1 = c.offset(0, -1, 0);

            outer: for (let m = 0, len = predecessors.length; m < len; m++)
            {
                const successors = bot.pathfinder.getSuccessors(predecessors[m]);
                for (let n = 0, len = successors.length; n < len; n++)
                {
                    if (c0.equals(successors[n]))
                    {
                        traversable = true;
                        break outer;
                    }
                    else if (c1.equals(successors[n]))
                    {
                        c0 = c1;
                        traversable = true;
                        break outer;
                    }
                }
            }

            // Updates state

            if (traversable)
            {
                const v = new State(c0);
                predecessors.unshift(v.c); // Introduce v to state
            }
            else
            {
                if (!S.check(c0))
                    c0 = c1;
            }

            for (let n = 0, len = predecessors.length; n < len; n++)
            {
                const u = new State(predecessors[n]);

                if (u !== S.goal)
                {
                    u.rhs = Number.POSITIVE_INFINITY;

                    const successors = bot.pathfinder.getSuccessors(u.c);
                    for (let m = 0, len = successors.length; m < len; m++)
                    {
                        const sp = new State(successors[m]);
                        const cost = bot.pathfinder.COST(u.c, sp.c) + sp.g;
                        if (u.rhs > cost) u.rhs = cost;
                    }
                }

                updateVertex(u);
            }

            return returnState.path.replan(bot.entity.position.floored());
        };
    };

    // Global state functions
    const S = [];
    S.push = function(s)
    {
        const y = s.c.y >>> 0;
        const x = s.c.x >>> 0;

        if (!this[y])
            this[y] = [];
        if (!this[y][x])
            this[y][x] = [];

        this[y][x][s.c.z >>> 0] = s;
    };
    S.check = function(c)
    {
        const y = c.y >>> 0;
        if (this[y])
        {
            const x = c.x >>> 0;
            if (this[y][x])
            {
                if (this[y][x][c.z >>> 0])
                    return true;
            }
        } return false;
    };
    S.remove = function(c)
    {
        this[c.y >>> 0][c.x >>> 0][c.z >>> 0] = undefined;
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
            return S[c.y >>> 0][c.x >>> 0][c.z >>> 0];
        else
        {
            this.c = c;
            this.g = Number.POSITIVE_INFINITY;
            this.rhs = Number.POSITIVE_INFINITY;

            this.k = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

            S.push(this);
        }
    }

    // Algorithm functions
    function calculateKey(s)
    {
        return [
            Math.min(s.g, s.rhs) + bot.pathfinder.HEURISTIC(S.start.c, s.c) + k_m,
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
            for (let i = 0; i < bot.pathfinder.MAX_EXPANSIONS && U.size !== 0 &&
                (compareKeys(U.peek().k, calculateKey(S.start)) || S.start.rhs > S.start.g); i++)
            {
                const u = U.peek();
                const k_old = u.k;
                const k_new = calculateKey(u);

                if (compareKeys(k_old, k_new))
                    U.update(0, k_new);

                else if (u.g > u.rhs)
                {
                    u.g = u.rhs;
                    U.pop(); // U.remove from first

                    const predecessors = bot.pathfinder.getPredecessors(u.c);
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new State(predecessors[n]);

                        if (s !== S.goal) s.rhs = Math.min(s.rhs, bot.pathfinder.COST(s.c, u.c) + u.g);
                        updateVertex(s);
                    }
                }
                else
                {
                    const g_old = u.g;
                    u.g = Number.POSITIVE_INFINITY;

                    const predecessors = bot.pathfinder.getPredecessors(u.c);
                    predecessors.unshift(u.c); // ∪ {u}
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new State(predecessors[n]);
                        if (floatEqual(s.rhs, bot.pathfinder.COST(s.c, u.c) + g_old))
                        {
                            if (s !== S.goal)
                            {
                                s.rhs = Number.POSITIVE_INFINITY;

                                const successors = bot.pathfinder.getSuccessors(s.c);
                                for (let m = 0, len = successors.length; m < len; m++)
                                {
                                    const sp = new State(successors[m]);
                                    const cost = bot.pathfinder.COST(s.c, sp.c) + sp.g;
                                    if (s.rhs > cost) s.rhs = cost;
                                }
                            }
                        }
                        updateVertex(s);
                    }
                }
            }

            if (S.start.rhs === Number.POSITIVE_INFINITY)
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Incomplete});
            else
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Complete});
        });

        return CSPPromise;
    }

    // Initialize

    let k_m = 0;

    S.start = new State(sp.floored());
    S.goal = new State(ep.floored());
    S.goal.rhs = 0;

    S.last = S.start;

    U.insert(
        S.goal,
        [bot.pathfinder.HEURISTIC(S.start.c, S.goal.c), 0]
    );

    return new DLITEReturnState().path.replan();
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
