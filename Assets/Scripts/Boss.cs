using UnityEngine;

// The floor's gatekeeper. Guards the portal inside the boss chamber. Neutral until provoked,
// so you can approach to parley (bribe it to stand aside) or just fight it. Either way the portal opens.
[RequireComponent(typeof(Rigidbody2D))]
public class Boss : MonoBehaviour
{
    public float hp, maxHp;
    public float speed = 1.9f;
    public float touchDmg = 22f;
    public Portal portal;
    public bool provoked;     // won't hunt until attacked or challenged
    public int cost;          // bribe price to make it stand aside

    Rigidbody2D rb;
    SpriteRenderer sr;
    Color baseCol;
    Transform target;
    float flashT, knockT;
    Vector2 knockV;

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
        cost = 30 + 12 * f;
    }

    public void Provoke() { provoked = true; }

    public void StandAside()
    {
        if (portal != null) portal.Open();
        Destroy(gameObject);
    }

    void Update()
    {
        if (flashT > 0f) { flashT -= Time.deltaTime; if (flashT <= 0f && sr != null) sr.color = baseCol; }
    }

    void FixedUpdate()
    {
        if (rb == null) return;
        if (knockT > 0f) { knockT -= Time.fixedDeltaTime; rb.linearVelocity = knockV; knockV *= 0.88f; return; }
        if (!provoked || target == null) { rb.linearVelocity = Vector2.zero; return; }   // guards the chamber, won't hunt yet
        Vector2 to = (Vector2)target.position - rb.position;
        float d = to.magnitude;
        rb.linearVelocity = (d < 15f && d > 1.0f) ? to.normalized * speed : Vector2.zero;
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
