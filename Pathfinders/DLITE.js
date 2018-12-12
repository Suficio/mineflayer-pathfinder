const Path = require('path');
const DLITEReturnState = require(Path.resolve(__dirname, 'DLITEReturnState.js'));

module.exports = function(bot, sp, ep)
{
    // D* Lite as per S. Koenig, 2002
    // Compute Shortest Path and UpdateVertex as described in http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf
    // Based on an optimized version of D* Lite as presented in Figure 4.

    // The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for convenient changes of costs
    // at runtime, which can be used for entity avoidance.

    const ReturnState = new DLITEReturnState(bot, sp, ep, UpdateVertex, ComputeShortestPath);
    const R = ReturnState;

    function CalculateKey(s)
    {
        return [Math.min(s.g, s.rhs) + bot.navigate.HEURISTIC(R.s_start, s) + R.km, Math.min(s.g, s.rhs)];
    }

    function UpdateVertex(u)
    {
        const exists = this.U.check(u); // Integer index
        const equals = floatEqual(u.g, u.rhs);

        if (!equals && exists !== undefined) this.U.update(exists, CalculateKey(u));
        else if (!equals && exists === undefined) this.U.insert(u, CalculateKey(u));
        else if (equals && exists !== undefined) this.U.remove(exists);
    }

    function ComputeShortestPath()
    {
        const R = this;
        const CSPPromise = new Promise(function(resolve)
        {
            let closest = R.s_goal;

            for (let i = 0; i < bot.navigate.MAX_EXPANSIONS && R.U.size !== 0 &&
                (CompareKeys(R.U.peek().k, CalculateKey(R.s_start)) || R.s_start.rhs > R.s_start.g); i++)
            {
                const u = R.U.peek();
                const k_old = u.k;
                const k_new = CalculateKey(u);

                if (CompareKeys(k_old, k_new))
                    R.U.update(u, k_new);
                else if (u.g > u.rhs)
                {
                    u.g = u.rhs;
                    R.U.pop(); // U.remove from first

                    const predecessors = bot.navigate.getPredecessors(u.p);
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new R.State(predecessors[n]);
                        if (s !== R.s_goal) s.rhs = Math.min(s.rhs, bot.navigate.HEURISTIC(s, u) + u.g);
                        R.UpdateVertex(s);
                    }
                }
                else
                {
                    const g_old = u.g;
                    u.g = Number.POSITIVE_INFINITY;

                    const predecessors = bot.navigate.getPredecessors(u.p);
                    predecessors.push(u.p); // ∪ {u}
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new R.State(predecessors[n]);
                        if (floatEqual(s, bot.navigate.HEURISTIC(s, u) + g_old))
                        {
                            if (s !== R.s_goal)
                            {
                                s.rhs = Number.POSITIVE_INFINITY;

                                const successors = bot.navigate.getSuccessors(u.p);
                                for (let m = 0, len = successors.length; m < len; m++)
                                {
                                    const sp = new R.State(successors[m]);
                                    const cost = bot.navigate.HEURISTIC(s, sp) + sp.g;
                                    if (s.rhs > cost) s.rhs = cost;
                                }
                            }
                        }
                        R.UpdateVertex(s);
                    }
                }

                // Storest closest element
                if (closest.p.distanceTo(R.s_start.p) > R.U.peek().p.distanceTo(R.s_start.p)) closest = R.U.peek();
            }
            if (R.s_start.rhs === Number.POSITIVE_INFINITY)
                resolve({ENUMStatus: bot.navigate.ENUMStatus.Incomplete, State: closest});
            else
                resolve({ENUMStatus: bot.navigate.ENUMStatus.Complete, State: closest});
        });

        return CSPPromise;
    }

    return ReturnState;
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
