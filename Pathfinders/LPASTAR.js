'use strict';
const Heap = require('fastpriorityqueue');

module.exports = function(bot, sp, ep)
{
    function LPASTARReturnState()
    {
        const returnState = this;

        // Path functions

        let internalPath = [];
        let oldInternalPath = [];
        this.path = {};
        this.path.peek = function()
        {
            return internalPath[internalPath.length - 1];
        };
        this.path.pop = function()
        {
            return internalPath.pop();
        };
        this.path.replan = function(sp)
        {
            console.log('replan');
            internalPath = [];

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

                        // Backtrack along original path until new path is found
                        // So sorry for this monstrosity

                        const tempPath = [];
                        let state = intermediateObject.state;
                        tempPath.push(state.c);

                        while (state.p)
                        {
                            state = state.p;
                            tempPath.push(state.c);
                        }

                        let found = false;

                        if (sp !== undefined)
                        {
                            outer: for (let i = 0, len = oldInternalPath.length; i < len; i++)
                            {
                                const c = oldInternalPath[i];
                                if (found || c.equals(sp.floored()))
                                {
                                    found = true;
                                    internalPath.push(c);

                                    for (let n = 0, tlen = tempPath.length; n < tlen; n++)
                                    {
                                        if (c.equals(tempPath[n]))
                                        {
                                            while (n > 0)
                                                internalPath.push(tempPath[--n]);

                                            break outer;
                                        }
                                    }
                                }
                            }
                        }

                        if (found)
                            internalPath = internalPath.reverse();
                        else
                            internalPath = tempPath;

                        oldInternalPath = internalPath.slice(0);

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

            let traversable = false;

            outer: for (let m = 0, len = predecessors.length; m < len; m++)
            {
                const successors = bot.pathfinder.getSuccessors(predecessors[m]);
                for (let n = 0, len = successors.length; n < len; n++)
                {
                    if (c.equals(successors[n]))
                    {
                        traversable = true;
                        break outer;
                    }
                }
            }

            // Edge costs are also assumed to not change implying rhs(v) > g(u) + c(u, v), is only true when g(u) is not infinity, which it always is.
            // Effectively, the first two conditions can never be satisfied.
            if (!traversable)
            {
                const u = new State(c);

                for (let m = 0, len = predecessors.length; m < len; m++)
                {
                    const v = new State(predecessors[m]);

                    if (v !== S.start && v.p === u)
                    {
                        v.rhs = Number.POSITIVE_INFINITY;

                        const predecessors = bot.pathfinder.getPredecessors(v.c);
                        for (let n = 0, len = predecessors.length; n < len; n++)
                        {
                            const sp = new State(predecessors[n]);
                            const cost = bot.pathfinder.COST(sp.c, v.c) + sp.g;

                            if (v.rhs > cost)
                            {
                                v.rhs = cost;
                                v.p = sp;
                            }
                        }

                        updateVertex(v);
                    }
                }

                S.remove(c);
            }

            return returnState.path.replan(bot.entity.position.floored());
        };
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
    S.check = function(c)
    {
        const x = c.x >>> 0;
        if (this[x])
        {
            const y = c.y >>> 0;
            if (this[x][y])
            {
                if (this[x][y][c.z >>> 0])

                    return true;
            }
        } return false;
    };
    S.remove = function(c)
    {
        if (this.check(c))
            this[c.x >>> 0][c.y >>> 0][c.z >>> 0] = undefined;
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
    S.start = new State(sp.floored());
    S.start.rhs = 0;

    S.goal = new State(ep.floored());

    U.insert(
        S.start,
        [bot.pathfinder.HEURISTIC(S.start.c, S.goal.c), 0]
    );

    return new LPASTARReturnState().path.replan();
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
