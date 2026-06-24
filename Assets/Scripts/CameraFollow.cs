using UnityEngine;

public class CameraFollow : MonoBehaviour
{
    public static CameraFollow Inst;
    public Transform target;
    public float smooth = 8f;

    float shakeAmt;

    void Awake() { Inst = this; }

    // any system can request a screen shake
    public static void Kick(float amt) { if (Inst != null) Inst.shakeAmt = Mathf.Max(Inst.shakeAmt, amt); }

    void LateUpdate()
    {
        if (target != null)
        {
            Vector3 p = target.position;
            p.z = -10f;
            transform.position = Vector3.Lerp(transform.position, p, 1f - Mathf.Exp(-smooth * Time.deltaTime));
        }
        if (shakeAmt > 0.002f)
        {
            Vector2 off = Random.insideUnitCircle * shakeAmt;
            transform.position += new Vector3(off.x, off.y, 0f);
            shakeAmt = Mathf.Lerp(shakeAmt, 0f, 12f * Time.deltaTime);
        }
        else shakeAmt = 0f;
    }
}
