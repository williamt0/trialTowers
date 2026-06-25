using UnityEngine;

// An enemy shot. Flies straight, damages the player on contact, is blocked by walls, and expires.
[RequireComponent(typeof(SpriteRenderer))]
public class Projectile : MonoBehaviour
{
    public float dmg = 10f;
    public float life = 3f;

    void Awake()
    {
        var rb = gameObject.AddComponent<Rigidbody2D>();
        rb.gravityScale = 0f;
        rb.freezeRotation = true;
        rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;   // don't tunnel thin walls
        var col = gameObject.AddComponent<CircleCollider2D>();
        col.isTrigger = true;
        col.radius = 1.2f;   // local; scaled by the 0.35 quad
    }

    void Update()
    {
        life -= Time.deltaTime;
        if (life <= 0f) Destroy(gameObject);
    }

    void OnTriggerEnter2D(Collider2D c)
    {
        var p = c.GetComponent<Player>();
        if (p != null) { p.Hurt(dmg, transform.position); Destroy(gameObject); return; }
        if (c.GetComponent<Wall>() != null) Destroy(gameObject);   // blocked by walls (any tier)
    }

    public static void Spawn(Transform parent, Vector2 pos, Vector2 vel, float dmg, Color col)
    {
        var go = SpriteFactory.Quad("Shot", pos, new Vector2(0.35f, 0.35f), col, 7);
        if (parent != null) go.transform.SetParent(parent);
        var pr = go.AddComponent<Projectile>();
        pr.dmg = dmg;
        go.GetComponent<Rigidbody2D>().linearVelocity = vel;
    }
}
