using UnityEngine;

// A destructible room prop. Solid (blocks movement, caught by the player's melee OverlapCircle and shots).
// Crates drop loot when broken; barrels instead explode (AoE via Damage.Explode — no barrel chaining).
[RequireComponent(typeof(SpriteRenderer))]
public class Prop : MonoBehaviour
{
    public bool barrel;
    public float hp = 20f;

    bool broken;
    SpriteRenderer sr;
    Color baseCol;
    float flashT;

    void Awake()
    {
        sr = GetComponent<SpriteRenderer>();
        if (sr != null) baseCol = sr.color;
        gameObject.AddComponent<BoxCollider2D>();   // solid (non-trigger): blocks the player + is hit by melee/shots
    }

    void Update()
    {
        if (flashT > 0f) { flashT -= Time.deltaTime; if (flashT <= 0f && sr != null) sr.color = baseCol; }
    }

    public void TakeDamage(float d, Vector2 from)
    {
        if (broken) return;
        if (sr != null) sr.color = Color.white;
        flashT = 0.08f;
        hp -= d;
        if (hp <= 0f) Break();
    }

    void Break()
    {
        if (broken) return;   // idempotent: never double-break (no loot dup, no re-explode)
        broken = true;
        if (barrel)
        {
            Damage.Explode(transform.position, 3.0f, 24f);
        }
        else
        {
            CameraFollow.Kick(0.08f);
            Pickup.Spawn(transform.parent, transform.position, 0, 8, new Color(0.95f, 0.8f, 0.3f));   // coins
            if (Random.value < 0.4f)
                Pickup.Spawn(transform.parent, (Vector2)transform.position + Vector2.right * 0.4f, 18, 0, new Color(0.4f, 0.9f, 0.5f));   // sometimes health
        }
        Destroy(gameObject);
    }

    public static Prop Spawn(Transform parent, Vector2 pos, bool barrel)
    {
        Color col = barrel ? new Color(0.72f, 0.36f, 0.18f) : new Color(0.55f, 0.42f, 0.28f);
        var go = SpriteFactory.Quad(barrel ? "Barrel" : "Crate", pos, new Vector2(0.9f, 0.9f), col, 2);
        if (parent != null) go.transform.SetParent(parent);
        var p = go.AddComponent<Prop>();
        p.barrel = barrel;
        p.hp = barrel ? 14f : 20f;
        return p;
    }
}
