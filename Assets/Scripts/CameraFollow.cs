using UnityEngine;

public class CameraFollow : MonoBehaviour
{
    public Transform target;
    public float smooth = 8f;

    void LateUpdate()
    {
        if (target == null) return;
        Vector3 p = target.position;
        p.z = -10f;
        transform.position = Vector3.Lerp(transform.position, p, 1f - Mathf.Exp(-smooth * Time.deltaTime));
    }
}
