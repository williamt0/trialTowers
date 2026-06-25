using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class Enemy : MonoBehaviour
{
    public int kind;        // 0 chaser, 1 ranged-kiter, 2 brute
    public float hp = 30f;
    public float speed = 2.4f;
    public float touchDmg = 14f;

    Rigidbody2D rb;
    SpriteRenderer sr;
    Color baseCol;
    Transform target;
    float flashT, knockT, shootCd;
    Vector2 knockV;
    bool elite;
    bool minion;   // boss-summoned add: drops no loot, decrements Boss.liveMinions on death
    bool fuseLit, detonated;   // bomber (kind 3): fuse state + one-shot detonation guard
    float fuseT, blast = 26f;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        sr = GetComponent<SpriteRenderer>();
        if (sr != null) baseCol = sr.color;
    }

    public void Init(Transform player, int floorNum, int k)
    {
        target = player;
        kind = k;
        int f = Mathf.Max(0, floorNum - 1);
        if (k == 1)       { hp = 18f + 6f * f;  speed = 2.3f; touchDmg = 8f + 2f * f; }                                              // ranged
        else if (k == 2)  { hp = 60f + 18f * f; speed = 1.4f; touchDmg = 20f + 4f * f; transform.localScale = new Vector3(1.3f, 1.3f, 1f); }  // brute
        else if (k == 3)  { hp = 20f + 6f * f;  speed = 3.3f; touchDmg = 0f; blast = 22f + 3f * f; if (sr != null) { baseCol = new Color(0.9f, 0.4f, 0.2f); sr.color = baseCol; } }  // bomber: fast, no contact dmg, explodes
        else              { hp = 25f + 8f * f;  speed = 2.5f; touchDmg = 12f + 2.5f * f; }                                           // chaser
        shootCd = Random.Range(0.5f, 1.6f);
    }

    // upgrade an already-Init'd enemy into an elite: tougher, hits harder, bigger, golden, drops more.
    // Multiplies scale so it composes over the kind's scale (brute 1.3, others the 0.85 quad base).
    public void MakeElite(int floorNum)
    {
        elite = true;
        hp *= 2.2f;
        touchDmg *= 1.4f;
        speed *= 1.06f;
        transform.localScale *= 1.45f;
        if (sr != null)
        {
            baseCol = Color.Lerp(baseCol, new Color(0.96f, 0.82f, 0.28f), 0.6f);   // golden tell (Update restores to baseCol after a hit-flash)
            sr.color = baseCol;
        }
    }

    // downgrade an Init'd enemy into a boss-summoned minion: weaker, smaller, purple, no loot
    public void MakeMinion()
    {
        minion = true;
        hp *= 0.4f;
        transform.localScale *= 0.85f;
        if (sr != null) { baseCol = Color.Lerp(baseCol, new Color(0.6f, 0.32f, 0.72f), 0.55f); sr.color = baseCol; }
    }

    void Update()
    {
        if (flashT > 0f) { flashT -= Time.deltaTime; if (flashT <= 0f && sr != null) sr.color = baseCol; }

        if (kind == 1 && target != null)
        {
            shootCd -= Time.deltaTime;
            float d = Vector2.Distance(transform.position, target.position);
            if (shootCd <= 0f && d < 13f && d > 2f)
            {
                Vector2 dir = ((Vector2)target.position - (Vector2)transform.position).normalized;
                Projectile.Spawn(transform.parent, (Vector2)transform.position + dir * 0.7f, dir * 7.5f, touchDmg, new Color(1f, 0.55f, 0.3f));
                shootCd = 1.6f;
            }
        }

        if (kind == 3 && !detonated && target != null)   // bomber: rush in, plant, blow
        {
            if (!fuseLit)
            {
                if (Vector2.Distance(transform.position, target.position) < 1.8f) { fuseLit = true; fuseT = 0.6f; }
            }
            else
            {
                fuseT -= Time.deltaTime;
                if (sr != null) sr.color = Color.Lerp(baseCol, Color.white, Mathf.PingPong(Time.time * 18f, 1f));   // fast blink: about to blow
                if (fuseT <= 0f) Detonate();
            }
        }
    }

    void FixedUpdate()
    {
        if (rb == null) return;
        if (knockT > 0f) { knockT -= Time.fixedDeltaTime; rb.linearVelocity = knockV; knockV *= 0.86f; return; }
        if (target == null) { rb.linearVelocity = Vector2.zero; return; }

        Vector2 to = (Vector2)target.position - rb.position;
        float dist = to.magnitude;
        Vector2 n = dist > 0.001f ? to / dist : Vector2.zero;

        if (kind == 3 && fuseLit) { rb.linearVelocity = Vector2.zero; return; }   // bomber planted: hold position through the fuse

        if (kind == 1)        // ranged: kite at mid-range
        {
            if (dist < 5f) rb.linearVelocity = -n * speed;
            else if (dist > 9f) rb.linearVelocity = n * speed;
            else rb.linearVelocity = Vector2.zero;
        }
        else                  // chaser / brute: rush
        {
            rb.linearVelocity = (dist < 13f && dist > 0.7f) ? n * speed : Vector2.zero;
        }
    }

    void OnCollisionStay2D(Collision2D c)
    {
        if (touchDmg <= 0f) return;   // bombers do no contact damage; also avoids refreshing the player's i-frames pre-blast
        var p = c.collider.GetComponent<Player>();
        if (p != null) p.Hurt(touchDmg, transform.position);
    }

    // bomber payload: one guarded AoE that also drops loot + feeds Momentum (a bomber is a real kill).
    // `detonated` is set BEFORE Damage.Explode so a chain reaction that loops back here is a no-op (bounded recursion).
    void Detonate()
    {
        if (detonated) return;
        detonated = true;
        Damage.Explode(transform.position, 3.2f, blast);
        int coin = 5 + (elite ? 15 : 0);
        var hero = Bootstrap.Hero;
        if (hero != null) { coin = Mathf.RoundToInt(coin * hero.CoinMult); hero.RegisterKill(); }
        Pickup.Spawn(transform.parent, transform.position, 0, coin, new Color(0.95f, 0.8f, 0.3f));
        if (elite || Random.value < 0.3f)
            Pickup.Spawn(transform.parent, (Vector2)transform.position + Vector2.right * 0.5f, elite ? 35 : 20, 0, new Color(0.4f, 0.9f, 0.5f));
        Destroy(gameObject);
    }

    public void TakeDamage(float d, Vector2 from)
    {
        if (detonated) return;   // an already-detonating bomber ignores further hits (e.g. from its own/another blast)
        if (sr != null) sr.color = Color.white;
        flashT = 0.1f;
        knockV = ((Vector2)transform.position - from).normalized * (kind == 2 ? 3f : 6f);   // brutes resist knockback
        knockT = 0.14f;
        hp -= d;
        FloatingText.Spawn(transform.position, Mathf.RoundToInt(d).ToString(), new Color(1f, 0.95f, 0.7f), elite ? 17f : 14f);
        if (hp <= 0f)
        {
            if (kind == 3) { Detonate(); return; }   // killing a bomber sets it off (kamikaze)
            CameraFollow.Kick(elite ? 0.2f : 0.12f);
            if (minion)
            {
                Boss.liveMinions = Mathf.Max(0, Boss.liveMinions - 1);   // no loot: minions don't subsidize the bribe economy
            }
            else
            {
                int coin = (kind == 2 ? 10 : 5) + (elite ? 15 : 0);
                var hero = Bootstrap.Hero;
                if (hero != null) { coin = Mathf.RoundToInt(coin * hero.CoinMult); hero.RegisterKill(); }   // momentum: scale by streak, then extend it
                Pickup.Spawn(transform.parent, transform.position, 0, coin, new Color(0.95f, 0.8f, 0.3f));   // coin orb (elites pay more)
                if (elite || Random.value < 0.3f)
                    Pickup.Spawn(transform.parent, (Vector2)transform.position + Vector2.right * 0.5f, elite ? 35 : 20, 0, new Color(0.4f, 0.9f, 0.5f));   // health orb (guaranteed from elites)
            }
            Destroy(gameObject);
        }
    }
}
