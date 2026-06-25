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
    public float rangedDmg = 16f, rangedCd = 0.5f;
    public float novaDmg = 26f, novaCd = 6f, novaRadius = 3.6f;

    Rigidbody2D rb;
    Vector2 face = Vector2.down;
    float cd, iframe, knockT, dashT, dashCdT, rangedCdT, burnCd, novaCdT;
    Vector2 knockV, dashDir;

    // 0..1 cooldown readiness for the HUD pips (1 = ready)
    public float DashReady { get { return dashCd > 0f ? Mathf.Clamp01(1f - dashCdT / dashCd) : 1f; } }
    public float RangedReady { get { return rangedCd > 0f ? Mathf.Clamp01(1f - rangedCdT / rangedCd) : 1f; } }
    public float NovaReady { get { return novaCd > 0f ? Mathf.Clamp01(1f - novaCdT / novaCd) : 1f; } }

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
        if (rangedCdT > 0f) rangedCdT -= Time.deltaTime;
        if (burnCd > 0f) burnCd -= Time.deltaTime;
        if (novaCdT > 0f) novaCdT -= Time.deltaTime;
        if (dead || !Bootstrap.InputReady || Bootstrap.Paused) return;
        if ((Input.GetKeyDown(KeyCode.Space) || Input.GetMouseButtonDown(0)) && cd <= 0f)
            Attack();
        if ((Input.GetMouseButtonDown(1) || Input.GetKeyDown(KeyCode.Q)) && rangedCdT <= 0f)
            Shoot();
        if (Input.GetKeyDown(KeyCode.LeftShift) && dashCdT <= 0f)
        {
            dashT = dashTime;
            dashCdT = dashCd;
            iframe = Mathf.Max(iframe, dashTime + 0.05f);   // i-frames: dash dodges contact damage
            dashDir = (face.sqrMagnitude > 0.01f ? face : Vector2.down);
        }
        if (Input.GetKeyDown(KeyCode.F) && novaCdT <= 0f)
            Nova();
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
            var pr = h.GetComponent<Prop>();
            if (pr != null) { pr.TakeDamage(atkDmg, rb.position); continue; }
            var e = h.GetComponent<Enemy>();
            if (e != null) { e.TakeDamage(atkDmg, rb.position); continue; }
            var b = h.GetComponent<Boss>();
            if (b != null) b.TakeDamage(atkDmg, rb.position);
        }
    }

    void Shoot()
    {
        rangedCdT = rangedCd;
        Vector2 dir = (face.sqrMagnitude > 0.01f ? face : Vector2.down).normalized;
        Projectile.Spawn(Bootstrap.WorldRoot, rb.position + dir * 0.7f, dir * 12f, rangedDmg, new Color(0.55f, 0.9f, 1f), true);   // friendly shot
    }

    // Nova (F): an omnidirectional shockwave damaging walls, enemies, and an ALREADY-provoked boss in a radius.
    // The boss branch is gated on b.provoked so the 3.6 radius (> the 2.9 parley range) can't silently start the fight.
    void Nova()
    {
        novaCdT = novaCd;
        Vector2 c = rb.position;
        var hits = Physics2D.OverlapCircleAll(c, novaRadius);
        foreach (var h in hits)
        {
            var w = h.GetComponent<Wall>();
            if (w != null) { w.TakeDamage(novaDmg); continue; }
            var pr = h.GetComponent<Prop>();
            if (pr != null) { pr.TakeDamage(novaDmg, c); continue; }
            var e = h.GetComponent<Enemy>();
            if (e != null) { e.TakeDamage(novaDmg, c); continue; }
            var b = h.GetComponent<Boss>();
            if (b != null && b.provoked) b.TakeDamage(novaDmg, c);
        }
        NovaRing.Spawn(Bootstrap.WorldRoot, c, novaRadius);
        CameraFollow.Kick(0.25f);
    }

    // environmental DoT (hazards): no knockback / camera kick / i-frame interaction, just a gated HP pulse
    public void Burn(float d)
    {
        if (dead || burnCd > 0f) return;
        burnCd = 0.45f;
        hp = Mathf.Max(0f, hp - d);
        hurtFlash = Mathf.Max(hurtFlash, 0.25f);
        if (hp <= 0f)
        {
            dead = true;
            if (rb != null) rb.linearVelocity = Vector2.zero;
        }
    }

    public void Hurt(float d, Vector2 from)
    {
        if (dead || iframe > 0f) return;
        hp = Mathf.Max(0f, hp - d);
        FloatingText.Spawn(transform.position, Mathf.RoundToInt(d).ToString(), new Color(1f, 0.4f, 0.35f), 18f);
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
