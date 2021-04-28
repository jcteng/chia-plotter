# Chia-Plot
a chia tool for expose chia rpc interfaces

## library - chia
access chia service via websocket/cli/http RPC
### http api
- [x] fullNode RPC api
- [ ] farmer RPC api
- [ ] wallet RPC api
### cli api
- [x] version
- [ ] create chia plot job with log storage as plot job


### ws api
- [x] 用于获取daemon中的plotting queue
- [ ] 删除指定的task
- [ ] websocket重连时API不可用


## libray - chia Ex
chia功能扩展
### chia扩展功能 log
log解析
- [ ] plot job pool public key
- [ ] plot job farmer public key:
- [ ] memo hex
- [ ] plotting parameters
- [ ] Progress In phase
- [ ] complete time In phase
- [ ] cpu usage in phase
- [ ] 解析.chia\mainnet\plotter
- [ ]
状态功能：
- [ ] check is daemon running (via process)
- [ ] check fullNode running(via process)
- [ ] check harvester running(via process)
- [ ] check wallet running (via process)
- [ ] check farmer running (via process)


## 参考
chia-gui使用Log的行数对进度进行计算

```javascript
const FINISHED_LOG_LINES = 2626; // 128
// const FINISHED_LOG_LINES_64 = 1379; // 64
// const FINISHED_LOG_LINES_32 = 754; // 32
```