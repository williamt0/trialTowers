using UnityEngine;

// The floor's gatekeeper. Guards the portal inside the boss chamber; on death it opens the portal.
[RequireComponent(typeof(Rigidbody2D))]
public class Boss : MonoBehaviour
{
    public float hp, maxHp;
    public float speed = 1.9f;
    public float touchDmg = 22f;
    public Portal portal;

    Rigidbody2D rb;
    Transform target;

    public void Init(Transform player, Portal p, int floorNum)
    {
        target = player;
        portal = p;
        rb = GetComponent<Rigidbody2D>();
        maxHp = hp = 200f + 55f * Mathf.Max(0, floorNum - 1);   // tougher each floor
        speed = 1.8f + 0.12f * Mathf.Max(0, floorNum - 1);
    }

    void FixedUpdate()
    {
        if (rb == null || target == null) return;
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
        hp -= d;
        if (hp <= 0f)
        {
            if (portal != null) portal.Open();
            Destroy(gameObject);
        }
    }
}
