using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class Enemy : MonoBehaviour
{
    public float hp = 30f;
    public float speed = 2.4f;
    public float touchDmg = 14f;     // per hit (gated by the player's i-frames so it can't stack/chip-kill)

    Rigidbody2D rb;
    Transform target;

    public void Init(Transform player)
    {
        target = player;
        rb = GetComponent<Rigidbody2D>();
    }

    void FixedUpdate()
    {
        if (rb == null) return;
        if (target == null) { rb.linearVelocity = Vector2.zero; return; }
        Vector2 to = (Vector2)target.position - rb.position;
        float d = to.magnitude;
        rb.linearVelocity = (d < 11f && d > 0.7f) ? to.normalized * speed : Vector2.zero;
    }

    void OnCollisionStay2D(Collision2D c)
    {
        var p = c.collider.GetComponent<Player>();
        if (p != null) p.Hurt(touchDmg);
    }

    public void TakeDamage(float d)
    {
        hp -= d;
        if (hp <= 0f) Destroy(gameObject);
    }
}
