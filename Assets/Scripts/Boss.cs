using UnityEngine;

// The floor's gatekeeper. Guards the portal inside the boss chamber. Neutral until provoked,
// so you can approach to parley (bribe it to stand aside) or just fight it. Either way the portal opens.
// Once provoked it chases and, on a cooldown, freezes to telegraph an attack — a radial ring,
// an aimed fan, or (act III+) a committed charge — then enrages (faster, denser bursts) below a third HP.
[RequireComponent(typeof(Rigidbody2D))]
public class Boss : MonoBehaviour
{
    public float hp, maxHp;
    public float speed = 1.9f;
    public float touchDmg = 22f;
    public float shotDmg = 12f;
    public Portal portal;
    public bool provoked;     // won't hunt until attacked or challenged
    public int cost;          // bribe price to make it stand aside

    Rigidbody2D rb;
    SpriteRenderer sr;
    Color baseCol;
    Transform target;
    float flashT, knockT, atkCd, windT;
    int pendingPattern;
    bool enraged;
    Vector2 knockV;
    int floor;
    float chargeT, chargeSpeed = 11f;
    Vector2 chargeDir;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        sr = GetComponent<SpriteRenderer>();
        if (sr != null) baseCol = sr.color;
    }

    public void Init(Transform player, Portal p, int floorNum)
    {
        target = player;
        portal = p;
        int f = Mathf.Max(0, floorNum - 1);
        maxHp = hp = 200f + 55f * f;     // tougher each floor
        speed = 1.8f + 0.12f * f;
        shotDmg = 10f + 2.5f * f;
        cost = 30 + 12 * f;
        atkCd = 2.2f;                     // a brief grace before the first volley
        floor = floorNum;
        chargeSpeed = 10f + 0.4f * f;
    }

    public void Provoke() { provoked = true; }

    public void StandAside()
    {
        if (portal != null) portal.Open();
        Destroy(gameObject);
    }

    bool Winding => windT > 0f;
    bool Charging => chargeT > 0f;

    void Update()
    {
        // hit-flash decay (skip the restore while winding — the telegraph drives the colour then)
        if (flashT > 0f) { flashT -= Time.deltaTime; if (flashT <= 0f && !Winding && sr != null) sr.color = baseCol; }
        if (!provoked || target == null) return;

        if (Charging)   // mid-lunge: ride it out, then recover
        {
            chargeT -= Time.deltaTime;
            if (chargeT <= 0f) atkCd = enraged ? 1.6f : 2.8f;
            return;
        }

        if (Winding)
        {
            windT -= Time.deltaTime;
            if (sr != null) sr.color = Color.Lerp(baseCol, Color.white, Mathf.PingPong(Time.time * 12f, 1f));   // pulsing tell
            if (windT <= 0f)
            {
                FirePattern(pendingPattern);
                if (sr != null && flashT <= 0f) sr.color = baseCol;
                if (pendingPattern != 2) atkCd = enraged ? 1.5f : 2.6f;   // a charge sets its own cd when it ends
            }
            return;
        }

        atkCd -= Time.deltaTime;
        float dist = Vector2.Distance(transform.position, target.position);
        if (atkCd <= 0f && dist < 16f)
        {
            pendingPattern = PickPattern();
            windT = enraged ? 0.38f : 0.5f;     // freeze and flash before the attack
        }
    }

    // act III+ gatekeepers fold a charge into the ring/fan mix; lower floors stay purely ranged
    int PickPattern()
    {
        if (floor >= 7 && Random.value < 0.33f) return 2;   // charge
        return Random.value < 0.5f ? 0 : 1;                 // ring or fan
    }

    void FixedUpdate()
    {
        if (rb == null) return;
        if (knockT > 0f) { knockT -= Time.fixedDeltaTime; rb.linearVelocity = knockV; knockV *= 0.88f; return; }
        if (!provoked || target == null || Winding) { rb.linearVelocity = Vector2.zero; return; }   // guard / stand still to wind up
        if (Charging) { rb.linearVelocity = chargeDir * chargeSpeed; return; }                       // lunge in the locked direction
        Vector2 to = (Vector2)target.position - rb.position;
        float d = to.magnitude;
        rb.linearVelocity = (d < 15f && d > 1.0f) ? to.normalized * speed : Vector2.zero;
    }

    void FirePattern(int pattern)
    {
        Vector2 origin = transform.position;
        Color shotCol = new Color(1f, 0.5f, 0.25f);
        if (pattern == 2)   // committed charge: lock onto the player's position and lunge
        {
            chargeDir = ((Vector2)target.position - origin).normalized;
            if (chargeDir.sqrMagnitude < 0.01f) chargeDir = Vector2.down;
            chargeT = 0.55f;
            CameraFollow.Kick(0.2f);
            return;
        }
        if (pattern == 0)   // radial ring
        {
            int n = (enraged ? 14 : 10) + (floor >= 8 ? 4 : 0);   // denser in the final act
            float off = Random.value * Mathf.PI;   // rotate the ring a little each time
            for (int i = 0; i < n; i++)
            {
                float a = off + i * (Mathf.PI * 2f / n);
                Vector2 dir = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                Projectile.Spawn(transform.parent, origin + dir * 0.9f, dir * 6f, shotDmg, shotCol);
            }
        }
        else                // aimed fan at the player
        {
            Vector2 aim = ((Vector2)target.position - origin).normalized;
            if (aim.sqrMagnitude < 0.01f) aim = Vector2.down;
            int shots = (enraged ? 5 : 3) + (floor >= 8 ? 2 : 0);
            float spread = 14f;   // degrees between shots
            for (int i = 0; i < shots; i++)
            {
                float deg = (i - (shots - 1) / 2f) * spread;
                Vector2 dir = Quaternion.Euler(0f, 0f, deg) * aim;
                Projectile.Spawn(transform.parent, origin + dir * 0.9f, dir * 8f, shotDmg, shotCol);
            }
        }
        CameraFollow.Kick(0.12f);
    }

    void OnCollisionStay2D(Collision2D c)
    {
        var p = c.collider.GetComponent<Player>();
        if (p != null) p.Hurt(touchDmg, transform.position);
    }

    public void TakeDamage(float d, Vector2 from)
    {
        provoked = true;                  // striking the gatekeeper provokes it (combat route)
        if (sr != null) sr.color = Color.white;
        flashT = 0.1f;
        knockV = ((Vector2)transform.position - from).normalized * 3.5f;   // heavier — less knockback
        knockT = 0.12f;
        hp -= d;
        if (!enraged && hp <= maxHp * 0.35f)   // last-third desperation: faster, denser, angrier
        {
            enraged = true;
            speed *= 1.4f;
            baseCol = new Color(1f, 0.3f, 0.2f);
            atkCd = Mathf.Min(atkCd, 0.5f);
            CameraFollow.Kick(0.3f);
        }
        if (hp <= 0f)
        {
            if (portal != null) portal.Open();
            CameraFollow.Kick(0.4f);
            Pickup.Spawn(transform.parent, transform.position, 40, 0, new Color(0.4f, 0.9f, 0.5f));   // a big heal for the win
            for (int i = 0; i < 3; i++)
                Pickup.Spawn(transform.parent, (Vector2)transform.position + Random.insideUnitCircle * 1.5f, 0, 15, new Color(0.95f, 0.8f, 0.3f));
            Destroy(gameObject);
        }
    }
}
