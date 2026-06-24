using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class Enemy : MonoBehaviour
{
    public float hp = 30f;
    public float speed = 2.4f;
    public float touchDmg = 14f;

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

    public void Init(Transform player, int floorNum)
    {
        target = player;
        int f = Mathf.Max(0, floorNum - 1);
        hp = 25f + 8f * f;             // tougher each floor
        speed = 2.2f + 0.08f * f;
        touchDmg = 12f + 2.5f * f;
    }

    void Update()
    {
        if (flashT > 0f) { flashT -= Time.deltaTime; if (flashT <= 0f && sr != null) sr.color = baseCol; }
    }

    void FixedUpdate()
    {
        if (rb == null) return;
        if (knockT > 0f) { knockT -= Time.fixedDeltaTime; rb.linearVelocity = knockV; knockV *= 0.86f; return; }
        if (target == null) { rb.linearVelocity = Vector2.zero; return; }
        Vector2 to = (Vector2)target.position - rb.position;
        float d = to.magnitude;
        rb.linearVelocity = (d < 11f && d > 0.7f) ? to.normalized * speed : Vector2.zero;
    }

    void OnCollisionStay2D(Collision2D c)
    {
        var p = c.collider.GetComponent<Player>();
        if (p != null) p.Hurt(touchDmg, transform.position);
    }

    public void TakeDamage(float d, Vector2 from)
    {
        if (sr != null) sr.color = Color.white;
        flashT = 0.1f;
        knockV = ((Vector2)transform.position - from).normalized * 6f;
        knockT = 0.14f;
        hp -= d;
        if (hp <= 0f)
        {
            if (target != null) { var p = target.GetComponent<Player>(); if (p != null) p.coins += 5; }
            CameraFollow.Kick(0.12f);
            Destroy(gameObject);
        }
    }
}
