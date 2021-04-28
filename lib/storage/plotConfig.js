
//plot config 是创建JOB的模板
/**
 *
 */
let sample = {
    k_size: 32,
    b_buffer: 3390,
    r_num_threads : 4,
    u_buckets : 96,
    t_tmp_dir : "SSDDIR",
    d_final_dir: "HDD/NAS DIR",
    e_nobitfield: false,
    n_num: 1,
    x_exclude_final_dir: true,
    $2_tmp2_dir: null,
}
class PlotConfig{
    save(){}
    load(){}
    list(){}
    scanFromDisk(){}
}