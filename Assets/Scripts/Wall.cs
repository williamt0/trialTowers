using UnityEngine;

// Tiered breakable wall (ports the v2 WALL_TIER system): 0 = timber, 1 = stone, 2 = reinforced, -1 = unbreakable boundary.
public class Wall : MonoBehaviour
{
    public int tier;
    public float hp, maxHp;

    static readonly Color[] TIER_COL =
    {
        new Color(0.42f, 0.33f, 0.21f),  // 0 timber
        new Color(0.27f, 0.27f, 0.31f),  // 1 stone
        new Color(0.35f, 0.39f, 0.46f),  // 2 reinforced
    };
    static readonly float[] TIER_HP = { 28f, 55f, 130f };

    SpriteRenderer sr;

    public void Init(int t)
    {
        tier = t;
        sr = GetComponent<SpriteRenderer>();
        if (t < 0)
        {
            maxHp = hp = Mathf.Infinity;                // boundary: indestructible
            if (sr != null) sr.color = new Color(0.20f, 0.20f, 0.24f);
        }
        else
        {
            int ti = Mathf.Clamp(t, 0, 2);
            maxHp = hp = TIER_HP[ti];
            if (sr != null) sr.color = TIER_COL[ti];
        }
    }

    public void TakeDamage(float d)
    {
        if (tier < 0) return;                            // unbreakable
        hp -= d;
        int ti = Mathf.Clamp(tier, 0, 2);
        if (sr != null) sr.color = Color.Lerp(Color.black, TIER_COL[ti], 0.4f + 0.6f * Mathf.Clamp01(hp / maxHp));
        if (hp <= 0f) Destroy(gameObject);               // breached
    }
}
