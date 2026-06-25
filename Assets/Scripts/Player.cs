using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class Player : MonoBehaviour
{
    public float speed = 6.5f;
    public float hp = 100f, maxHp = 100f;
    public float atkRange = 1.7f, atkDmg = 30f, atkCd = 0.30f;
    public bool dead;
    public int coins;
    public float hurtFlash;
    public float dashSpeed = 18f, dashTime = 0.16f, dashCd = 0.7f;

    Rigidbody2D rb;
    Vector2 face = Vector2.down;
    float cd, iframe, knockT, dashT, dashCdT;
    Vector2 knockV, dashDir;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        if (cd > 0f) cd -= Time.deltaTime;
        if (iframe > 0f) iframe -= Time.deltaTime;
        if (hurtFlash > 0f) hurtFlash -= Time.deltaTime;
        if (dashCdT > 0f) dashCdT -= Time.deltaTime;
        if (dead || !Bootstrap.InputReady || Bootstrap.Paused) return;
        if ((Input.GetKeyDown(KeyCode.Space) || Input.GetMouseButtonDown(0)) && cd <= 0f)
            Attack();
        if (Input.GetKeyDown(KeyCode.LeftShift) && dashCdT <= 0f)
        {
            dashT = dashTime;
            dashCdT = dashCd;
            iframe = Mathf.Max(iframe, dashTime + 0.05f);   // i-frames: dash dodges contact damage
            dashDir = (face.sqrMagnitude > 0.01f ? face : Vector2.down);
        }
    }

    void FixedUpdate()
    {
        if (knockT > 0f) { knockT -= Time.fixedDeltaTime; rb.linearVelocity = knockV; knockV *= 0.85f; return; }
        if (dashT > 0f) { dashT -= Time.fixedDeltaTime; rb.linearVelocity = dashDir * dashSpeed; return; }
        if (dead || !Bootstrap.InputReady || Bootstrap.Paused) { rb.linearVelocity = Vector2.zero; return; }
        Vector2 mv = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        if (mv.sqrMagnitude > 1f) mv.Normalize();
        if (mv.sqrMagnitude > 0.01f) face = mv.normalized;
        rb.linearVelocity = mv * speed;
    }

    void Attack()
    {
        cd = atkCd;
        Vector2 c = rb.position + face * (atkRange * 0.55f);
        var hits = Physics2D.OverlapCircleAll(c, atkRange * 0.7f);
        foreach (var h in hits)
        {
            var w = h.GetComponent<Wall>();
            if (w != null) { w.TakeDamage(atkDmg * 0.6f + 8f); continue; }
            var e = h.GetComponent<Enemy>();
            if (e != null) { e.TakeDamage(atkDmg, rb.position); continue; }
            var b = h.GetComponent<Boss>();
            if (b != null) b.TakeDamage(atkDmg, rb.position);
        }
    }

    public void Hurt(float d, Vector2 from)
    {
        if (dead || iframe > 0f) return;
        hp = Mathf.Max(0f, hp - d);
        iframe = 0.5f;
        hurtFlash = 0.35f;
        knockV = ((Vector2)transform.position - from).normalized * 4f;
        knockT = 0.10f;
        CameraFollow.Kick(0.2f);
        if (hp <= 0f)
        {
            dead = true;
            knockT = 0f;
            if (rb != null) rb.linearVelocity = Vector2.zero;
        }
    }
}
