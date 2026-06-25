using UnityEngine;

// A brief expanding shockwave for the player's Nova ability — purely cosmetic, no collider.
// Grows from a point to ~2x the nova radius and fades out, then self-destructs.
[RequireComponent(typeof(SpriteRenderer))]
public class NovaRing : MonoBehaviour
{
    float t, maxR;
    const float Life = 0.35f;
    SpriteRenderer sr;
    Color baseCol;

    void Awake()
    {
        sr = GetComponent<SpriteRenderer>();
        if (sr != null) baseCol = sr.color;
    }

    void Update()
    {
        t += Time.deltaTime;
        float k = Mathf.Clamp01(t / Life);
        float diam = Mathf.Lerp(0.5f, maxR * 2f, k);
        transform.localScale = new Vector3(diam, diam, 1f);
        if (sr != null) { var c = baseCol; c.a = (1f - k) * 0.5f; sr.color = c; }
        if (t >= Life) Destroy(gameObject);
    }

    public static void Spawn(Transform parent, Vector2 pos, float radius)
    {
        Spawn(parent, pos, radius, new Color(0.5f, 0.85f, 1f, 0.5f));
    }

    public static void Spawn(Transform parent, Vector2 pos, float radius, Color col)
    {
        var go = SpriteFactory.Quad("Ring", pos, Vector2.one, col, 7);
        if (parent != null) go.transform.SetParent(parent);
        go.AddComponent<NovaRing>().maxR = radius;   // static method of the same class may set the private field
    }
}
