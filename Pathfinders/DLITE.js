const Vec3 = require('vec3');
const Heap = require('fastpriorityqueue');

function IntermediateState(ENUMStatus,Path)
{
    this.ENUMStatus = ENUMStatus;
    this.Path = Path;
}

function ReturnState(MainPromise)
{
    this.MainPromise = MainPromise;
    this.MainPromise
        .then(function(IntermediateState)
        {
            
        }.bind(this))
        .catch(function(){return});
}

module.exports = function(bot,sp,ep)
{
    // D* Lite as per S. Koenig, 2002
    // Roughly as described in http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf

    // The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for convenient changes of costs
    // at runtime, which can be used for entity avoidance.

    function State(p)
    {
        if(RS.S.check(p)) 
            return RS.S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
        else {

            this.p = p;
            this.g = Number.POSITIVE_INFINITY;
            this.rhs = Number.POSITIVE_INFINITY;
            
            this.k;
        }
    }

    const R = new ReturnState();

        R.km = 0;
        R.UpdateVertex = UpdateVertex;
        R.ComputeShortestPath = ComputeShortestPath;

        // Global state functions
        R.S = [];
            R.S.push = function(s) {

                var x = s.p.x >>> 0;
                var y = s.p.y >>> 0;
        
                if(!this[x]) {
                    this[x] = [];
                } if(!this[x][y]) {
                    this[x][y] = [];
                }
        
                this[x][y][s.p.z >>> 0] = s;
            }
            R.S.check = function(p) {
        
                var x = p.x >>> 0;
                if(this[x]) {
                    var y = p.y >>> 0;
                    if(this[x][y]) {
                        if(this[x][y][p.z >>> 0]) {
                            return true;
                        }
                    }
                } return false;
            }

        // Priority queue functions
        R.U = new Heap(function(s1,s2) {
            // Compared according to lexicographic ordering
            if(floatEqual(s1.k[0],s2.k[0])) {
                if(floatEqual(s1.k[1],s2.k[1])) return 0;
                else if(s1.k[1] < s2.k[1]) return -1;
            } else if(s1.k[0]<s2.k[0]) return -1;
            else return 1;
        })
            R.U.check = function(s) {
                for(var i = 0; i < this.size; i++) {
                    if(this.array[i].p.equals(s.p)) return i;
                } return undefined;
            }
            R.U.insert = function(s,k) {
                s.k = k;
                this.add(s);
            }
            R.U.update = function(i,k) {
                this.array[i].k = k;
                this._percolateUp(i);              
            }
            // Maintain familiarity with original heap implementation
            R.U.remove = U._removeAt;
            R.U.pop = U.poll;

        R.s_start = new State(sp);
        R.s_goal = new State(ep);
            R.s_goal.rhs = 0;

        R.U.insert(R.s_goal,[bot.navigate.HEURISTIC(R.s_start,R.s_goal),0]);

    function CalculateKey(s)
    {
        return [Math.min(s.g,s.rhs) + bot.navigate.HEURISTIC(R.s_start,s) + R.km,Math.min(s.g,s.rhs)];
    }

    function UpdateVertex(u)
    {
        const equals = floatEqual(u.g,u.rhs); // Also an integer
        const exists = R.U.check(u);

        if(!equals && exists) R.U.update(exists,CalculateKey(s));
        else if(!equals && !exists) R.U.insert(u,CalculateKey(s));
        else if(equals && exists) R.U.remove(exists);
    }

    function ComputeShortestPath()
    {
        function CompareKeys(k1,k2)
        {
            return (floatEqual(k1[0],k2[0]) && k1[1] < k2[1]) || k1[0] < k2[0];
        }

        const s_startKey = CalculateKey(R.s_start);
        for(var i = 0; i < bot.navigate.MAX_EXPANSIONS && U.size !== 0 && (CompareKeys(R.U.peek().k,s_startKey) || R.s_start.rhs > R.s_start.g); i++)
        {
            const u = R.U.peek();
            const k_old = u.k;
            const k_new = CalculateKey(u);

            if(CompareKeys(k_old,k_new))
                R.U.update(R.U.check(u),k_new);
            else if(u.g > u.rhs) {
                u.g = u.rhs;
                U.remove(R.U.check(u));

                const predecessors = bot.navigate.getPredecessors(u.p);
                for(var n = 0, len = predecessors.length; n < len; n++)
                {
                    const s = new State(successors[n]);
                    if(!s.p.equals(R.s_goal.p)) s.rhs = Math.min(s.rhs,bot.navigate.HEURISTIC(s,u) + u.g);
                    UpdateVertex(s);
                }
            } else {
                
            }
        }
    }

    const CSPPromise = new Promise(function(resolve,reject)
    {
        function CP(s)
        {
            const Path = [s.p];
            while(s.cF) {
                s = s.cF;
                Path.push(s.p);
            }

            return Path;
        }

        // Maintains the element with the best path
        let closest = new State(sp.floored());
            closest.g = 0; // Otherwise POSITIVE_INFINITY - POSITIVE_INFINITY returns NaN

        const end = new State(ep.floored());
        const start = new State(sp.floored());
            start.g = 0;
            start.f = bot.navigate.HEURISTIC(start,end);

        O.push(start);

        for(var i = 0; i < bot.navigate.MAX_EXPANSIONS && O.size !== 0; i++) {

            const current = O.pop();
            if(current.p.equals(end.p)) return resolve(new IntermediateState(bot.navigate.ENUMStatus.Complete,CP(current)));
            C.push(current);

            const successors = bot.navigate.getSuccessors(current.p);
            // successors = JPSN(current);
            for(var n = 0, len = successors.length; n < len; n++) {

                if(C.check(successors[n])) continue;
                const s = new State(successors[n]);

                const tg = current.g + bot.navigate.COST(current,s);
                if(tg >= s.g) continue;

                s.cF = current;
                s.g = tg;
                s.f = s.g + bot.navigate.HEURISTIC(s,end);

                const m = O.check(s);
                if(!m) O.push(s); else O.replace(m,s);
            };

            // Retains the closest element to the end
            if(current.f - current.g < closest.f - closest.g) closest = current;
        };

        console.log("WARNING: Did not find path in allowed MAX_EXPANSIONS, returned closest path");
        return resolve(new IntermediateState(bot.navigate.ENUMStatus.Incomplete,CP(closest)));
    });

    return FinalState
}

function floatEqual(f1, f2)
{
    return Math.abs(f1 - f2) < Number.EPSILON;
}