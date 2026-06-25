using UnityEngine;

// A shot. Flies straight, is blocked by walls, and expires. Enemy shots hurt the player;
// friendly (player) shots hurt enemies and the boss. Either way it passes through its own side.
[RequireComponent(typeof(SpriteRenderer))]
public class Projectile : MonoBehaviour
{
    public float dmg = 10f;
    public float life = 3f;
    public bool friendly;   // true = player shot (hits enemies/boss); false = enemy shot (hits player)

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
        if (friendly)
        {
            var e = c.GetComponent<Enemy>();
            if (e != null) { e.TakeDamage(dmg, transform.position); Destroy(gameObject); return; }
            var b = c.GetComponent<Boss>();
            if (b != null) { b.TakeDamage(dmg, transform.position); Destroy(gameObject); return; }
            var pr = c.GetComponent<Prop>();
            if (pr != null) { pr.TakeDamage(dmg, transform.position); Destroy(gameObject); return; }   // pop crates/barrels from range
        }
        else
        {
            var p = c.GetComponent<Player>();
            if (p != null) { p.Hurt(dmg, transform.position); Destroy(gameObject); return; }
        }
        if (c.GetComponent<Wall>() != null || c.GetComponent<Prop>() != null) Destroy(gameObject);   // walls + props block any shot (cover)
    }

    public static void Spawn(Transform parent, Vector2 pos, Vector2 vel, float dmg, Color col, bool friendly = false)
    {
        var go = SpriteFactory.Quad("Shot", pos, new Vector2(0.35f, 0.35f), col, 7);
        if (parent != null) go.transform.SetParent(parent);
        var pr = go.AddComponent<Projectile>();
        pr.dmg = dmg;
        pr.friendly = friendly;
        go.GetComponent<Rigidbody2D>().linearVelocity = vel;
    }
}
