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
    Transform target;

    public void Init(Transform player, Portal p, int floorNum)
    {
        target = player;
        portal = p;
        rb = GetComponent<Rigidbody2D>();
        int f = Mathf.Max(0, floorNum - 1);
        maxHp = hp = 200f + 55f * f;     // tougher each floor
        speed = 1.8f + 0.12f * f;
        cost = 30 + 12 * f;
    }

    public void Provoke() { provoked = true; }

    // bribe / parley route: the gatekeeper steps aside and opens the portal without a fight
    public void StandAside()
    {
        if (portal != null) portal.Open();
        Destroy(gameObject);
    }

    void FixedUpdate()
    {
        if (rb == null || target == null) return;
        if (!provoked) { rb.linearVelocity = Vector2.zero; return; }   // guards the chamber, but won't hunt yet
        Vector2 to = (Vector2)target.position - rb.position;
        float d = to.magnitude;
        rb.linearVelocity = (d < 15f && d > 1.0f) ? to.normalized * speed : Vector2.zero;
    }

    void OnCollisionStay2D(Collision2D c)
    {
        var p = c.collider.GetComponent<Player>();
        if (p != null) p.Hurt(touchDmg);
    }

    public void TakeDamage(float d)
    {
        provoked = true;                  // striking the gatekeeper provokes it (combat route)
        hp -= d;
        if (hp <= 0f)
        {
            if (target != null) { var p = target.GetComponent<Player>(); if (p != null) p.coins += 25; }
            if (portal != null) portal.Open();
            Destroy(gameObject);
        }
    }
}
