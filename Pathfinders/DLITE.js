const Heap = require('fastpriorityqueue');

function ReturnState(MainPromise)
{
    this.MainPromise = MainPromise;
    this.MainPromise
        .then(function()
        {

        })
        .catch(function() {return;});
}

module.exports = function(bot, sp, ep)
{
    // D* Lite as per S. Koenig, 2002
    // Roughly as described in http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf

    // The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for convenient changes of costs
    // at runtime, which can be used for entity avoidance.

    function State(p)
    {
        if (R.S.check(p))
            return RS.S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
        else
        {
            this.p = p;
            this.g = Number.POSITIVE_INFINITY;
            this.rhs = Number.POSITIVE_INFINITY;

            this.k;

            R.S.push(this);
        }
    }

    const R = new ReturnState();

    R.km = 0;
    R.UpdateVertex = UpdateVertex;
    R.ComputeShortestPath = ComputeShortestPath;

    // Global state functions
    R.S = [];
    R.S.push = function(s)
    {
        const x = s.p.x >>> 0;
        const y = s.p.y >>> 0;

        if (!this[x])

            this[x] = [];
        if (!this[x][y])

            this[x][y] = [];


        this[x][y][s.p.z >>> 0] = s;
    };
    R.S.check = function(p)
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
    U = new Heap(function(s1, s2)
    {
        // Compared according to lexicographic ordering
        if (floatEqual(s1.k[0], s2.k[0]))
        {
            if (floatEqual(s1.k[1], s2.k[1])) return 0;
            else if (s1.k[1] < s2.k[1]) return -1;
        }
        else if (s1.k[0]<s2.k[0]) return -1;
        else return 1;
    });
    U.check = function(s)
    {
        for (let i = 0; i < this.size; i++)

            if (this.array[i].p.equals(s.p)) return i;
        return undefined;
    };
    U.insert = function(s, k)
    {
        s.k = k;
        this.add(s);
    };
    U.update = function(i, k)
    {
        this.array[i].k = k;
        this._percolateUp(i);
    };
    // Maintain familiarity with original heap implementation
    U.remove = U._removeAt;
    U.pop = U.poll;

    R.s_start = new State(sp);
    R.s_goal = new State(ep);
    R.s_goal.rhs = 0;

    U.insert(R.s_goal, [bot.navigate.HEURISTIC(R.s_start, R.s_goal), 0]);

    function CalculateKey(s)
    {
        return [Math.min(s.g, s.rhs) + bot.navigate.HEURISTIC(R.s_start, s) + R.km, Math.min(s.g, s.rhs)];
    }

    function UpdateVertex(u)
    {
        const equals = floatEqual(u.g, u.rhs); // Also an integer
        const exists = U.check(u);

        if (!equals && exists) U.update(exists, CalculateKey(s));
        else if (!equals && !exists) U.insert(u, CalculateKey(s));
        else if (equals && exists) U.remove(exists);
    }

    function ComputeShortestPath()
    {
        function CompareKeys(k1, k2)
        {
            return (floatEqual(k1[0], k2[0]) && k1[1] < k2[1]) || k1[0] < k2[0];
        }

        const s_startKey = CalculateKey(R.s_start);
        for (let i = 0; i < bot.navigate.MAX_EXPANSIONS && U.size !== 0 &&
            (CompareKeys(U.peek().k, s_startKey) || R.s_start.rhs > R.s_start.g); i++)
        {
            const u = U.peek();
            const k_old = u.k;
            const k_new = CalculateKey(u);

            if (CompareKeys(k_old, k_new))
                U.update(U.check(u), k_new);
            else if (u.g > u.rhs)
            {
                u.g = u.rhs;
                U.pop(); // U.remove(U.check(u));

                const predecessors = bot.navigate.getPredecessors(u.p);
                for (let n = 0, len = predecessors.length; n < len; n++)
                {
                    const s = new State(predecessors[n]);
                    if (!s.p.equals(R.s_goal.p)) s.rhs = Math.min(s.rhs, bot.navigate.HEURISTIC(s, u) + u.g);
                    UpdateVertex(s);
                }
            }
            else
            {
                const g_old = u.g;
                u.g = Number.POSITIVE_INFINITY;
                const predecessors = bot.navigate.getPredecessors(u.p);
                predecessors.push(u); // ∪ {u}
                for (let n = 0, len = predecessors.length; n < len; n++)
                {
                    const s = new State(predecessors[n]);
                    if (floatEqual(s.rhs, bot.navigate.HEURISTIC(s, u) + g_old))
                    {
                        if (!s.p.equals(R.s_goal.p))
                        {
                            // s.rhs = Math.min(s.rhs, bot.navigate.HEURISTIC(s, u) + u.g);
                            s.rhs = Number.POSITIVE_INFINITY;
                            const successors = bot.navigate.getSuccessors(s.p);
                            for (let m = 0, len = successors.length; m < len; m++)
                            {
                                const sp = new State(successors[m]);
                                const cost = bot.navigate.HEURISTIC(s, sp) + sp.g;
                                if (s.rhs > cost) s.rhs = cost;
                            }
                        }
                    }

                    UpdateVertex(s);
                }
            }
        }
    }

    return FinalState;
};

function floatEqual(f1, f2)
{
    return Math.abs(f1 - f2) < Number.EPSILON;
}
